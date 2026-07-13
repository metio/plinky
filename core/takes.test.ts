// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Composition } from "./composition";
import {
    type ActiveHolds,
    beginHold,
    compositionFromRun,
    endHold,
    fastestTakeOnsets,
    ghostOnsets,
    type RunStep,
    type Take,
    takeFromStored,
    takeToStored,
} from "./takes";

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


describe("ghostOnsets", () => {
    it("normalises a take's note onsets to start at zero", () => {
        expect(ghostOnsets(take("1", { composition: comp([200, 600, 1000]) }))).toEqual([
            0, 400, 800,
        ]);
    });

    it("is empty for a take with no notes", () => {
        expect(ghostOnsets(take("1", { composition: comp([]) }))).toEqual([]);
    });

    it("collapses a chord's shared onset to one step so the count matches the matcher", () => {
        // compositionFromRun stores one note per pitch, so a chord is several notes at the
        // same onset. The race and on-staff marker count one entry per step (chord = one
        // step), so the onsets must collapse — here three struck together, then one note.
        const chord: Composition = {
            notes: [
                { pitch: 60, startMs: 200, durationMs: 200, velocity: 90 },
                { pitch: 64, startMs: 200, durationMs: 200, velocity: 90 },
                { pitch: 67, startMs: 200, durationMs: 200, velocity: 90 },
                { pitch: 72, startMs: 700, durationMs: 200, velocity: 90 },
            ],
            tempo: 120,
            beatsPerBar: 4,
        };
        expect(ghostOnsets(take("1", { composition: chord }))).toEqual([0, 500]);
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

    it("caps an imprecise run's rested hold at the note's own slot", () => {
        // A finger rested on a touch key for 5s while hunting for the next note: without a
        // cap the note would ring the whole 5s. The gap to the next onset is 300ms, so an
        // imprecise run clamps the hold there rather than letting it run away.
        const composition = compositionFromRun(
            [{ pitches: [60], startMs: 0, velocity: 90, heldMs: 5000 }, step([62], 300)],
            120,
            4,
            true,
        );
        expect(composition.notes[0]?.durationMs).toBe(300);
    });

    it("keeps an imprecise run's quick tap staccato, shorter than the slot", () => {
        // A 90ms tap is well inside the 300ms slot, so the cap leaves it alone — a tap still
        // reads staccato on touch, only a runaway hold is clamped.
        const composition = compositionFromRun(
            [{ pitches: [60], startMs: 0, velocity: 90, heldMs: 90 }, step([62], 300)],
            120,
            4,
            true,
        );
        expect(composition.notes[0]?.durationMs).toBe(90);
    });

    it("trusts a precise MIDI hold verbatim, past the onset gap", () => {
        // The same 5s hold on a MIDI keyboard is a deliberate long note — the default
        // precise path keeps it whole.
        const composition = compositionFromRun(
            [{ pitches: [60], startMs: 0, velocity: 90, heldMs: 5000 }, step([62], 300)],
            120,
            4,
        );
        expect(composition.notes[0]?.durationMs).toBe(5000);
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

describe("takeToStored / takeFromStored", () => {
    it("round-trips a take through the compact stored shape", () => {
        const original = take("1", { metrics: grade(), complete: false });
        const revived = takeFromStored(JSON.parse(JSON.stringify(takeToStored(original))));
        expect(revived).toEqual(original);
    });

    it("reads junk, a missing code, or an unreadable code as no take", () => {
        expect(takeFromStored("junk")).toBeNull();
        expect(takeFromStored({ id: "x" })).toBeNull();
        expect(takeFromStored({ id: "x", code: "not-a-code" })).toBeNull();
    });

    it("reads an entry that predates stored metrics as having none", () => {
        const stored = takeToStored(take("1", { metrics: grade() }));
        const { metrics: _dropped, ...legacy } = stored;
        expect(takeFromStored(legacy)?.metrics).toBeNull();
    });
});

describe("compositionFromRun durations", () => {
    const step = (startMs: number, targetMs?: number, heldMs?: number) => ({
        pitches: [60],
        startMs,
        velocity: 90,
        ...(targetMs !== undefined ? { targetMs } : {}),
        ...(heldMs !== undefined ? { heldMs } : {}),
    });

    it("caps an unheld note at the notated gap so hunting for the next key adds silence", () => {
        // Notated a beat apart (500ms at 120bpm), but the player searched 3s.
        const composition = compositionFromRun([step(0, 0), step(3_000, 500)], 120, 4);
        expect(composition.notes[0]?.durationMs).toBe(500);
    });

    it("keeps the shorter actual gap when the player rushes ahead of the score", () => {
        const composition = compositionFromRun([step(0, 0), step(300, 500)], 120, 4);
        expect(composition.notes[0]?.durationMs).toBe(300);
    });

    it("falls back to the raw gap when a step carries no notated onset", () => {
        const composition = compositionFromRun([step(0), step(3_000)], 120, 4);
        expect(composition.notes[0]?.durationMs).toBe(3_000);
    });

    it("a measured MIDI hold always wins over the derived gap", () => {
        const composition = compositionFromRun([step(0, 0, 2_200), step(3_000, 500)], 120, 4);
        expect(composition.notes[0]?.durationMs).toBe(2_200);
    });

    it("ignores a degenerate notated gap (a chord's second onset at the same tick)", () => {
        const composition = compositionFromRun([step(0, 500), step(800, 500)], 120, 4);
        expect(composition.notes[0]?.durationMs).toBe(800);
    });
});
