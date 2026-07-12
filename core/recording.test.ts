// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    anchoredAt,
    EMPTY_RECORDING,
    noteOff,
    noteOn,
    tailMs,
    truncatedTo,
    withNotes,
} from "./recording";

// Press-and-release one note against a state, timestamps in the event clock.
const strike = (
    state: typeof EMPTY_RECORDING,
    note: number,
    at: number,
    holdMs = 100,
    velocity = 90,
) => noteOff(noteOn(state, { note, velocity, timestamp: at }), { note, timestamp: at + holdMs });

describe("tailMs", () => {
    it("is zero for an empty take and the last release otherwise", () => {
        expect(tailMs([])).toBe(0);
        expect(
            tailMs([
                { pitch: 60, startMs: 0, durationMs: 400, velocity: 90 },
                { pitch: 64, startMs: 100, durationMs: 150, velocity: 90 },
            ]),
        ).toBe(400);
    });
});

describe("noteOn / noteOff", () => {
    it("anchors the clock at the first press so the take starts at zero", () => {
        const state = strike(EMPTY_RECORDING, 60, 5_000);
        expect(state.notes).toEqual([{ pitch: 60, startMs: 0, durationMs: 100, velocity: 90 }]);
    });

    it("measures onsets and durations against the anchored origin", () => {
        let state = strike(EMPTY_RECORDING, 60, 1_000, 200);
        state = strike(state, 64, 1_500, 300);
        expect(state.notes).toEqual([
            { pitch: 60, startMs: 0, durationMs: 200, velocity: 90 },
            { pitch: 64, startMs: 500, durationMs: 300, velocity: 90 },
        ]);
    });

    it("keeps the list sorted by onset even when releases come out of order", () => {
        // 60 is pressed first but held longest, so it completes last.
        let state = noteOn(EMPTY_RECORDING, { note: 60, velocity: 90, timestamp: 1_000 });
        state = noteOn(state, { note: 64, velocity: 90, timestamp: 1_200 });
        state = noteOff(state, { note: 64, timestamp: 1_300 });
        state = noteOff(state, { note: 60, timestamp: 2_000 });
        expect(state.notes.map((note) => note.pitch)).toEqual([60, 64]);
        expect(state.notes.map((note) => note.startMs)).toEqual([0, 200]);
    });

    it("ignores a release with no matching press", () => {
        const state = noteOff(EMPTY_RECORDING, { note: 60, timestamp: 1_000 });
        expect(state).toBe(EMPTY_RECORDING);
    });

    it("defaults a silent (zero) velocity to a musical one", () => {
        const state = noteOff(noteOn(EMPTY_RECORDING, { note: 60, velocity: 0, timestamp: 0 }), {
            note: 60,
            timestamp: 100,
        });
        expect(state.notes[0]?.velocity).toBe(90);
    });

    it("clamps an instant release to a 1ms duration", () => {
        const state = strike(EMPTY_RECORDING, 60, 1_000, 0);
        expect(state.notes[0]?.durationMs).toBe(1);
    });

    it("appends new notes after the tail of pre-loaded notes", () => {
        const loaded = withNotes([{ pitch: 60, startMs: 0, durationMs: 400, velocity: 90 }]);
        const state = strike(loaded, 64, 9_000);
        expect(state.notes[1]).toMatchObject({ pitch: 64, startMs: 400 });
    });
});

describe("truncatedTo", () => {
    it("keeps the first notes and unanchors the clock so the tail resumes after them", () => {
        let state = strike(EMPTY_RECORDING, 60, 0, 100);
        state = strike(state, 62, 200, 100);
        state = strike(state, 64, 400, 100);
        const kept = truncatedTo(state, 2);
        expect(kept.notes.map((note) => note.pitch)).toEqual([60, 62]);
        expect(kept.originMs).toBeNull();
        // The next strike lands right after the kept tail, not after the cut note.
        const resumed = strike(kept, 65, 99_000);
        expect(resumed.notes[2]).toMatchObject({ pitch: 65, startMs: 300 });
    });
});

describe("anchoredAt", () => {
    it("pins the origin to the given instant, minus the existing tail", () => {
        const loaded = withNotes([{ pitch: 60, startMs: 0, durationMs: 500, velocity: 90 }]);
        // A downbeat at 10s: a note struck exactly then starts at the tail (500ms).
        const armed = anchoredAt(loaded, 10_000);
        const state = strike(armed, 64, 10_000);
        expect(state.notes[1]).toMatchObject({ pitch: 64, startMs: 500 });
    });

    it("drops any held notes — a count-in starts a fresh grid", () => {
        const holding = noteOn(EMPTY_RECORDING, { note: 60, velocity: 90, timestamp: 0 });
        const armed = anchoredAt(holding, 1_000);
        expect(armed.open.size).toBe(0);
    });
});
