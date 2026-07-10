// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { RecordedNote } from "./composition";
import { frameAt, frameTimesMs, LEAD_IN_MS, videoDurationMs } from "./videoFrames";

const noteArb: fc.Arbitrary<RecordedNote> = fc.record({
    pitch: fc.integer({ min: 21, max: 108 }),
    startMs: fc.integer({ min: 0, max: 60_000 }),
    durationMs: fc.integer({ min: 1, max: 5_000 }),
    velocity: fc.integer({ min: 1, max: 127 }),
});
const notesArb = fc.array(noteArb, { maxLength: 40 });

describe("videoFrames properties", () => {
    it("progress only ever moves forward as the clock does", () => {
        fc.assert(
            fc.property(
                notesArb,
                fc.integer({ min: 0, max: 70_000 }),
                fc.integer({ min: 0, max: 10_000 }),
                (notes, timeMs, aheadMs) => {
                    const now = frameAt(notes, timeMs);
                    const later = frameAt(notes, timeMs + aheadMs);
                    expect(later.done).toBeGreaterThanOrEqual(now.done);
                    expect(later.currentOnsetMs ?? -1).toBeGreaterThanOrEqual(now.currentOnsetMs ?? -1);
                },
            ),
        );
    });

    it("a key is down exactly while its note sounds", () => {
        fc.assert(
            fc.property(notesArb, fc.integer({ min: 0, max: 70_000 }), (notes, timeMs) => {
                const frame = frameAt(notes, timeMs);
                // Down keys and interval membership agree note for note — the
                // frame invents nothing and drops nothing.
                const t = timeMs - LEAD_IN_MS;
                const sounding = notes
                    .filter((n) => n.startMs <= t && t < n.startMs + n.durationMs)
                    .map((n) => `${n.pitch}@${n.velocity}`)
                    .sort();
                expect(frame.down.map((d) => `${d.pitch}@${d.velocity}`).sort()).toEqual(sounding);
            }),
        );
    });

    it("the last frame has heard every note, and frames cover the duration", () => {
        fc.assert(
            fc.property(notesArb, fc.integer({ min: 10, max: 60 }), (notes, fps) => {
                const duration = videoDurationMs(notes);
                const times = frameTimesMs(duration, fps);
                expect(times.length).toBeGreaterThan(0);
                // Strictly increasing and inside the duration.
                for (let i = 1; i < times.length; i++) {
                    expect(times[i]!).toBeGreaterThan(times[i - 1]!);
                }
                expect(times.at(-1)!).toBeLessThan(duration);
                // One more frame would start at or past the end.
                expect((times.length * 1000) / fps).toBeGreaterThanOrEqual(duration);
                const last = frameAt(notes, duration);
                expect(last.done).toBe(notes.length);
                expect(last.down).toEqual([]);
            }),
        );
    });
});
