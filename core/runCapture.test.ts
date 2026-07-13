// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    type ClearedNote,
    captureCleared,
    capturePedal,
    captureRelease,
    liveTempo,
    startCapture,
} from "./runCapture";

const cleared = (over: Partial<ClearedNote> = {}): ClearedNote => ({
    pitches: [60],
    ordinal: 0,
    timestamp: 5000,
    timeMs: 0,
    velocity: 80,
    wrongBefore: 0,
    staves: [0],
    ...over,
});

describe("runCapture", () => {
    it("counts both clocks from the first cleared note", () => {
        const capture = startCapture();
        captureCleared(capture, cleared({ ordinal: 0, timestamp: 5000, timeMs: 2000 }));
        captureCleared(capture, cleared({ ordinal: 1, timestamp: 5480, timeMs: 2500, pitches: [62] }));
        expect(capture.startedAt).toBe(5000);
        expect(capture.notes[0]).toMatchObject({ targetMs: 0, playedMs: 0 });
        expect(capture.notes[1]).toMatchObject({ targetMs: 500, playedMs: 480 });
    });

    it("fills a note's hold length from its release, keeping a chord's longest", () => {
        const capture = startCapture();
        captureCleared(capture, cleared({ pitches: [60, 64], timestamp: 1000 }));
        captureRelease(capture, 60, 1200);
        captureRelease(capture, 64, 1650);
        expect(capture.notes[0]?.heldMs).toBe(650);
    });

    it("ignores a stray release for a pitch never struck", () => {
        const capture = startCapture();
        captureCleared(capture, cleared());
        captureRelease(capture, 99, 2000);
        expect(capture.notes[0]?.heldMs).toBeUndefined();
    });

    it("keeps a note ringing when the key lifts under the sustain pedal", () => {
        const capture = startCapture();
        captureCleared(capture, cleared({ timestamp: 1000 }));
        capturePedal(capture, true, 1100);
        // The key lifts while the pedal is down: the note is held, not closed yet.
        captureRelease(capture, 60, 1200);
        expect(capture.notes[0]?.heldMs).toBeUndefined();
        // Lifting the pedal ends it, so the recorded hold runs to the pedal release.
        capturePedal(capture, false, 1800);
        expect(capture.notes[0]?.heldMs).toBe(800);
    });

    it("closes a pedalled note at its re-strike when the pitch sounds again", () => {
        const capture = startCapture();
        captureCleared(capture, cleared({ ordinal: 0, timestamp: 1000 }));
        capturePedal(capture, true, 1000);
        captureRelease(capture, 60, 1100); // key up, still pedalled
        // The same pitch is struck again — the first instance ended at this re-strike.
        captureCleared(capture, cleared({ ordinal: 1, timestamp: 1500, timeMs: 500 }));
        expect(capture.notes[0]?.heldMs).toBe(500);
        // The second instance is now the one the pedal holds.
        capturePedal(capture, false, 2000);
        captureRelease(capture, 60, 2000);
        expect(capture.notes[1]?.heldMs).toBe(500);
    });

    it("closes a hold normally when the key lifts with the pedal up", () => {
        const capture = startCapture();
        captureCleared(capture, cleared({ timestamp: 1000 }));
        captureRelease(capture, 60, 1400);
        expect(capture.notes[0]?.heldMs).toBe(400);
    });

    it("eases the live tempo toward the played pace, clamped to the slider range", () => {
        const capture = startCapture();
        // Notated 500ms apart at 100 BPM, played 250ms apart — twice the pace.
        captureCleared(capture, cleared({ ordinal: 0, timestamp: 0, timeMs: 0 }));
        captureCleared(capture, cleared({ ordinal: 1, timestamp: 250, timeMs: 500, pitches: [62] }));
        const next = liveTempo(capture, 100, 100);
        expect(next).toBeGreaterThan(100);
        expect(next).toBeLessThanOrEqual(180);
    });

    it("keeps the previous tempo until two notes exist or when the gap gives no estimate", () => {
        const capture = startCapture();
        expect(liveTempo(capture, 100, 96)).toBe(96);
        captureCleared(capture, cleared());
        expect(liveTempo(capture, 100, 96)).toBe(96);
        // A chord's second entry at the same notated onset: zero gap, no estimate.
        captureCleared(capture, cleared({ ordinal: 1, timestamp: 100, timeMs: 0, pitches: [64] }));
        expect(liveTempo(capture, 100, 96)).toBe(96);
    });
});
