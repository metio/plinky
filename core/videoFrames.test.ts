// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { RecordedNote } from "./composition";
import {
    frameAt,
    frameTimesMs,
    LEAD_IN_MS,
    PRESS_FADE_MS,
    pressGlow,
    TAIL_MS,
    videoDurationMs,
} from "./videoFrames";

const note = (startMs: number, durationMs = 500, pitch = 60): RecordedNote => ({
    pitch,
    startMs,
    durationMs,
    velocity: 96,
});

describe("videoDurationMs", () => {
    it("spans the lead-in, the last ring-out, and the tail", () => {
        const notes = [note(0), note(2_000, 1_000)];
        expect(videoDurationMs(notes)).toBe(LEAD_IN_MS + 3_000 + TAIL_MS);
    });

    it("keeps just the framing for an empty note list", () => {
        expect(videoDurationMs([])).toBe(LEAD_IN_MS + TAIL_MS);
    });
});

describe("frameTimesMs", () => {
    it("stamps frames by index over fps, covering the whole duration", () => {
        const times = frameTimesMs(1_000, 30);
        expect(times).toHaveLength(30);
        expect(times[0]).toBe(0);
        expect(times[3]).toBe(100);
        expect(times.at(-1)!).toBeLessThan(1_000);
    });

    it("keeps the last frame inside a duration that is a whole number of frames", () => {
        // 64_400 ms at 50 fps is exactly 3_220 frames; float division would
        // round the count up and stamp a frame at the very end.
        const times = frameTimesMs(64_400, 50);
        expect(times).toHaveLength(3_220);
        expect(times.at(-1)!).toBeLessThan(64_400);
    });
});

describe("frameAt", () => {
    const notes = [note(0, 500, 60), note(400, 400, 64), note(1_000, 500, 67)];

    it("is silent and cursorless during the lead-in", () => {
        const frame = frameAt(notes, 0);
        expect(frame.down).toEqual([]);
        expect(frame.currentOnsetMs).toBeNull();
        expect(frame.done).toBe(0);
        expect(frame.total).toBe(3);
    });

    it("holds overlapping notes down together and tracks the cursor", () => {
        // 450ms into the take: the first note still rings, the second has begun.
        const frame = frameAt(notes, LEAD_IN_MS + 450);
        expect(frame.down.map((d) => d.pitch).sort()).toEqual([60, 64]);
        expect(frame.currentOnsetMs).toBe(400);
        expect(frame.done).toBe(2);
    });

    it("lifts a key the instant its duration ends", () => {
        const frame = frameAt(notes, LEAD_IN_MS + 500);
        expect(frame.down.map((d) => d.pitch)).toEqual([64]);
    });

    it("rests with all keys up but full progress through the tail", () => {
        const frame = frameAt(notes, videoDurationMs(notes) - 1);
        expect(frame.down).toEqual([]);
        expect(frame.done).toBe(3);
        expect(frame.currentOnsetMs).toBe(1_000);
    });
});

describe("pressGlow", () => {
    it("is full at the press, decays while held, and never goes dark", () => {
        expect(pressGlow(0)).toBe(1);
        expect(pressGlow(PRESS_FADE_MS / 2)).toBeCloseTo(0.5);
        expect(pressGlow(PRESS_FADE_MS * 10)).toBeGreaterThan(0);
        expect(pressGlow(PRESS_FADE_MS * 10)).toBeLessThan(0.5);
    });

    it("a re-press outglows the same note held that long", () => {
        expect(pressGlow(0)).toBeGreaterThan(pressGlow(1_000));
    });
});

describe("frameAt heldMs", () => {
    it("reports how long each sounding note has been held", () => {
        const notes = [
            { pitch: 60, startMs: 0, durationMs: 1_000, velocity: 100 },
            { pitch: 64, startMs: 400, durationMs: 1_000, velocity: 100 },
        ];
        const frame = frameAt(notes, LEAD_IN_MS + 500);
        const byPitch = new Map(frame.down.map((entry) => [entry.pitch, entry.heldMs]));
        expect(byPitch.get(60)).toBe(500);
        expect(byPitch.get(64)).toBe(100);
    });
});
