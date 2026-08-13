// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { MatchStep } from "./matcher";
import { EVEN_VELOCITY, performanceLengthMs, performanceOf } from "./scorePerformance";

const step = (elapsedMs: number, pitches: number[], holdMs = 500, holds?: number[]): MatchStep => ({
    pitches,
    pitchStaves: pitches.map(() => 0),
    staves: [0],
    whole: 0,
    elapsedMs,
    holdMs,
    bar: 0,
    holdQuarters: 1,
    advancesCursor: true,
    slackMs: 0,
    pedalled: false,
    expected: holds?.map((h) => ({ velocity: null, holdMs: h })),
});

describe("performanceOf", () => {
    it("plays every note of every position, on time and held as written", () => {
        const notes = performanceOf([step(0, [60]), step(500, [62, 64])]);
        expect(notes).toEqual([
            { pitch: 60, startMs: 0, durationMs: 500, velocity: EVEN_VELOCITY },
            { pitch: 62, startMs: 500, durationMs: 500, velocity: EVEN_VELOCITY },
            { pitch: 64, startMs: 500, durationMs: 500, velocity: EVEN_VELOCITY },
        ]);
    });

    it("holds each key of a chord for what that key was asked", () => {
        // A held bass under a clipped treble is two lengths, not one.
        const notes = performanceOf([step(0, [48, 72], 2000, [2000, 200])]);
        expect(notes.map((n) => n.durationMs)).toEqual([2000, 200]);
    });

    it("starts at the first note, not at bar one", () => {
        // A piece opening with a rest must not open a short video with silence.
        expect(performanceOf([step(1500, [60])])[0]?.startMs).toBe(0);
    });

    it("stretches and compresses with the speed", () => {
        const half = performanceOf([step(0, [60]), step(1000, [62])], { speed: 0.5 });
        expect(half[1]?.startMs).toBe(2000);
        expect(half[0]?.durationMs).toBe(1000);
        const double = performanceOf([step(0, [60]), step(1000, [62])], { speed: 2 });
        expect(double[1]?.startMs).toBe(500);
    });

    it("cuts a clip on a position boundary, never inside a chord", () => {
        const steps = [step(0, [60]), step(900, [62, 65]), step(2000, [67])];
        const clip = performanceOf(steps, { withinMs: 1000 });
        expect(clip.map((n) => n.pitch)).toEqual([60, 62, 65]);
    });

    it("has nothing to play for a score with no positions", () => {
        expect(performanceOf([])).toEqual([]);
    });

    it("keeps a note that is still sounding when the clip ends", () => {
        // The cut is on onsets; a long note started before it keeps its full length, so
        // the sound rings out rather than stopping dead at the boundary.
        const clip = performanceOf([step(0, [60], 5000)], { withinMs: 1000 });
        expect(clip[0]?.durationMs).toBe(5000);
    });
});

describe("performanceLengthMs", () => {
    it("runs to the end of the last note sounding, not the last onset", () => {
        expect(
            performanceLengthMs([
                { pitch: 60, startMs: 0, durationMs: 4000, velocity: 80 },
                { pitch: 62, startMs: 1000, durationMs: 200, velocity: 80 },
            ]),
        ).toBe(4000);
    });

    it("is zero for nothing played", () => {
        expect(performanceLengthMs([])).toBe(0);
    });
});
