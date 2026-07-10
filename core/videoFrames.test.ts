// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { RecordedNote } from "./composition";
import { frameAt, frameTimesMs, LEAD_IN_MS, TAIL_MS, videoDurationMs } from "./videoFrames";

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
