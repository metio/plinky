// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import type { Composition } from "./composition";
import { withDeniedStorage } from "./deniedStorage";
import {
    type ActiveHolds,
    beginHold,
    compositionFromRun,
    endHold,
    fastestTakeOnsets,
    ghostOnsets,
    loadTakes,
    MAX_TAKES_PER_SONG,
    removeTake,
    type RunStep,
    type Take,
    saveTake,
} from "./savedTakes";

afterEach(() => localStorage.clear());

const comp = (starts: number[]): Composition => ({
    notes: starts.map((startMs, i) => ({ pitch: 60 + i, startMs, durationMs: 200, velocity: 90 })),
    tempo: 120,
    beatsPerBar: 4,
});

const take = (id: string, overrides: Partial<Take> = {}): Take => ({
    id,
    createdAt: Number(id),
    letter: "B",
    complete: true,
    metrics: null,
    composition: comp([0, 500, 1000]),
    ...overrides,
});

const grade = (
    overrides: Partial<Take["metrics"] & object> = {},
): NonNullable<Take["metrics"]> => ({
    accuracy: 92,
    timing: 84,
    flow: 88,
    dynamics: null,
    score: 87,
    letter: "B",
    ...overrides,
});

describe("saveTake / loadTakes", () => {
    it("round-trips a take through the share codec", () => {
        saveTake("song", take("1"));
        const loaded = loadTakes("song");
        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.letter).toBe("B");
        expect(loaded[0]?.composition.notes.map((n) => n.startMs)).toEqual([0, 500, 1000]);
    });

    it("keeps the newest first", () => {
        saveTake("song", take("1"));
        saveTake("song", take("2"));
        expect(loadTakes("song").map((t) => t.id)).toEqual(["2", "1"]);
    });

    it("round-trips a take's full metrics so a past run's grade survives a reload", () => {
        saveTake("song", take("1", { metrics: grade({ accuracy: 91, timing: 73, flow: 88 }) }));
        expect(loadTakes("song")[0]?.metrics).toEqual(
            grade({ accuracy: 91, timing: 73, flow: 88 }),
        );
    });

    it("stores no metrics for a take saved from an ungraded run", () => {
        saveTake("song", take("1", { metrics: null }));
        expect(loadTakes("song")[0]?.metrics).toBeNull();
    });

    it("reads a legacy take that predates stored metrics as having none", () => {
        // Save a normal take, then strip its metrics field to mimic an entry written
        // before takes stored a grade — it must still load, just without metrics.
        saveTake("song", take("1", { metrics: grade() }));
        const raw = JSON.parse(localStorage.getItem("plinky:takes:song") ?? "[]");
        delete raw[0].metrics;
        localStorage.setItem("plinky:takes:song", JSON.stringify(raw));
        const loaded = loadTakes("song");
        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.metrics).toBeNull();
        expect(loaded[0]?.composition.notes).toHaveLength(3);
    });

    it("drops a malformed metrics blob rather than failing the load", () => {
        saveTake("song", take("1"));
        const raw = JSON.parse(localStorage.getItem("plinky:takes:song") ?? "[]");
        raw[0].metrics = { accuracy: "oops", timing: 10 };
        localStorage.setItem("plinky:takes:song", JSON.stringify(raw));
        const loaded = loadTakes("song");
        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.metrics).toBeNull();
    });

    it("caps the list and drops the oldest", () => {
        for (let i = 1; i <= MAX_TAKES_PER_SONG + 2; i++) {
            saveTake("song", take(String(i)));
        }
        const loaded = loadTakes("song");
        expect(loaded).toHaveLength(MAX_TAKES_PER_SONG);
        // The two oldest (1, 2) fell off; the newest is first.
        expect(loaded[0]?.id).toBe(String(MAX_TAKES_PER_SONG + 2));
        expect(loaded.map((t) => t.id)).not.toContain("1");
    });

    it("keeps each song's takes separate", () => {
        saveTake("a", take("1"));
        saveTake("b", take("2"));
        expect(loadTakes("a").map((t) => t.id)).toEqual(["1"]);
        expect(loadTakes("b").map((t) => t.id)).toEqual(["2"]);
    });

    it("removes a take by id", () => {
        saveTake("song", take("1"));
        saveTake("song", take("2"));
        expect(removeTake("song", "1").map((t) => t.id)).toEqual(["2"]);
        expect(loadTakes("song").map((t) => t.id)).toEqual(["2"]);
    });

    it("drops a corrupt stored entry rather than failing the list", () => {
        localStorage.setItem(
            "plinky:takes:song",
            JSON.stringify([
                { id: "ok", createdAt: 1, letter: "A", complete: true, code: "x" },
                "junk",
            ]),
        );
        // The valid entry has an unreadable code, so it's skipped; no throw.
        expect(loadTakes("song")).toEqual([]);
    });
});

describe("ghostOnsets", () => {
    it("normalises a take's note onsets to start at zero", () => {
        expect(ghostOnsets(take("1", { composition: comp([200, 600, 1000]) }))).toEqual([
            0, 400, 800,
        ]);
    });

    it("is empty for a take with no notes", () => {
        expect(ghostOnsets(take("1", { composition: comp([]) }))).toEqual([]);
    });
});

describe("fastestTakeOnsets", () => {
    it("returns the onsets of the shortest-span complete take, normalised to zero", () => {
        const slow = take("1", { composition: comp([0, 1000, 2000]) });
        const fast = take("2", { composition: comp([200, 600, 1000]) }); // 800ms span
        expect(fastestTakeOnsets([slow, fast])).toEqual([0, 400, 800]);
    });

    it("ignores incomplete takes", () => {
        const partial = take("1", { complete: false, composition: comp([0, 100]) });
        const full = take("2", { composition: comp([0, 500, 1000]) });
        expect(fastestTakeOnsets([partial, full])).toEqual([0, 500, 1000]);
    });

    it("is null when no complete take exists", () => {
        expect(fastestTakeOnsets([take("1", { complete: false })])).toBeNull();
        expect(fastestTakeOnsets([])).toBeNull();
    });
});

describe("beginHold / endHold", () => {
    it("measures how long a key was held from strike to release", () => {
        const holds: ActiveHolds = new Map();
        beginHold(holds, 60, 0, 1000);
        expect(endHold(holds, 60, 1350)).toEqual({ index: 0, heldMs: 350 });
    });

    it("forgets a key once released, so a stray second release resolves to null", () => {
        const holds: ActiveHolds = new Map();
        beginHold(holds, 60, 2, 500);
        endHold(holds, 60, 700);
        expect(endHold(holds, 60, 900)).toBeNull();
    });

    it("resolves an untracked release to null rather than guessing", () => {
        expect(endHold(new Map(), 64, 100)).toBeNull();
    });

    it("keeps only the latest strike when a pitch repeats before releasing", () => {
        const holds: ActiveHolds = new Map();
        beginHold(holds, 67, 1, 0);
        beginHold(holds, 67, 4, 500); // same pitch, a new note
        expect(endHold(holds, 67, 800)).toEqual({ index: 4, heldMs: 300 });
    });
});

describe("compositionFromRun", () => {
    const step = (pitches: number[], startMs: number, velocity = 90): RunStep => ({
        pitches,
        startMs,
        velocity,
    });

    it("uses the real key-hold length when a run captured one", () => {
        // The gap to the next onset is 300ms, but the key was only held 90ms — a clipped
        // staccato — so the note keeps its actual length rather than smearing to the gap.
        const composition = compositionFromRun(
            [{ pitches: [60], startMs: 0, velocity: 90, heldMs: 90 }, step([62], 300)],
            120,
            4,
        );
        expect(composition.notes[0]?.durationMs).toBe(90);
    });

    it("uses the hold length even on the final note, past the onset gaps", () => {
        const composition = compositionFromRun(
            [{ pitches: [60], startMs: 0, velocity: 90, heldMs: 1200 }],
            120,
            4,
        );
        // Held long past the one-beat fallback, so the sustain is preserved.
        expect(composition.notes[0]?.durationMs).toBe(1200);
    });

    it("floors a very short hold to the minimum length, never zero", () => {
        const composition = compositionFromRun(
            [{ pitches: [60], startMs: 0, velocity: 90, heldMs: 5 }, step([62], 400)],
            120,
            4,
        );
        expect(composition.notes[0]?.durationMs).toBeGreaterThanOrEqual(60);
    });

    it("derives each note's length from the gap to the next onset", () => {
        const composition = compositionFromRun([step([60], 0), step([62], 300)], 120, 4);
        expect(composition.notes.map((n) => [n.pitch, n.startMs, n.durationMs])).toEqual([
            [60, 0, 300],
            // The last note has no successor, so it's held one beat (120bpm → 500ms).
            [62, 300, 500],
        ]);
    });

    it("expands a chord into notes sharing one onset", () => {
        const composition = compositionFromRun([step([60, 64, 67], 0), step([72], 400)], 120, 4);
        const chord = composition.notes.filter((n) => n.startMs === 0);
        expect(chord.map((n) => n.pitch)).toEqual([60, 64, 67]);
        expect(new Set(chord.map((n) => n.durationMs))).toEqual(new Set([400]));
    });

    it("carries the run's velocity and keeps tempo and metre", () => {
        const composition = compositionFromRun([step([60], 0, 40)], 90, 3);
        expect(composition.notes[0]?.velocity).toBe(40);
        expect(composition.tempo).toBe(90);
        expect(composition.beatsPerBar).toBe(3);
    });

    it("floors a near-simultaneous pair to a minimum length, never zero", () => {
        const composition = compositionFromRun(
            [step([60], 0), step([61], 5), step([62], 400)],
            120,
            4,
        );
        expect(composition.notes[0]?.durationMs).toBeGreaterThanOrEqual(60);
    });

    it("is empty for a run with no steps", () => {
        expect(compositionFromRun([], 120, 4)).toEqual({ notes: [], tempo: 120, beatsPerBar: 4 });
    });
});

describe("savedTakes under denied storage", () => {
    it("reads an empty list and swallows a save when storage is blocked", () => {
        expect(withDeniedStorage(() => loadTakes("song"))).toEqual([]);
        expect(() => withDeniedStorage(() => saveTake("song", take("1")))).not.toThrow();
    });
});
