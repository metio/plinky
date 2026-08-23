// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { MatchStep } from "./matcher";
import {
    EVEN_VELOCITY,
    fingeredFreely,
    performanceLengthMs,
    performanceOf,
} from "./scorePerformance";

const step = (elapsedMs: number, pitches: number[], holdMs = 500, holds?: number[]): MatchStep => ({
    pitches,
    pitchStaves: pitches.map(() => 0),
    pitchHands: pitches.map(() => "right" as const),
    staves: [0],
    whole: 0,
    elapsedMs,
    holdMs,
    bar: 0,
    holdQuarters: 1,
    advancesCursor: true,
    slackMs: 0,
    pedalled: false,
    expected: holds?.map((h) => ({ velocity: null, holdMs: h, writtenHoldMs: h })),
});

// A position the score marks: a written dynamic per pitch, and a weight for where the
// position falls in its bar and its phrase.
const marked = (velocities: (number | null)[], interpretation?: number): MatchStep => ({
    ...step(
        0,
        velocities.map((_, index) => 60 + index),
    ),
    expected: velocities.map((velocity) => ({ velocity, holdMs: 500, writtenHoldMs: 500 })),
    ...(interpretation === undefined ? {} : { interpretation }),
});

describe("performanceOf velocity", () => {
    it("strikes each key at what the page asks of it, not at one touch for the chord", () => {
        // A chord is not one note: an accent on the top and not the rest is a thing scores
        // write, and playing the position at a single loudness silently drops it.
        const notes = performanceOf([marked([64, 110])]);
        expect(notes.map((note) => note.velocity)).toEqual([64, 110]);
    });

    it("weights a struck note for where it sits", () => {
        // An offbeat is played lighter than the downbeat it follows. Rounded, and never
        // past what a MIDI velocity can carry.
        expect(performanceOf([marked([100], 0.84)])[0]?.velocity).toBe(84);
        expect(performanceOf([marked([127], 1)])[0]?.velocity).toBe(127);
    });

    it("falls back to an even touch where the page marks nothing", () => {
        // A step model collected without the score's marks — the sample prefetch, the
        // duet's other hand — knows nothing about loudness and must not invent any.
        expect(performanceOf([marked([null])])[0]?.velocity).toBe(EVEN_VELOCITY);
        expect(performanceOf([step(0, [60])])[0]?.velocity).toBe(EVEN_VELOCITY);
    });
});

describe("performanceOf", () => {
    it("plays every note of every position, on time and held as written", () => {
        const notes = performanceOf([step(0, [60]), step(500, [62, 64])]);
        // Fingering rides along on every note; the timing is what this pins.
        expect(
            notes.map(({ pitch, startMs, durationMs, velocity }) => ({
                pitch,
                startMs,
                durationMs,
                velocity,
            })),
        ).toEqual([
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

describe("fingering", () => {
    it("gives every note of a score-derived performance a finger and a hand", () => {
        const notes = performanceOf([step(0, [60]), step(500, [62]), step(1000, [64])]);
        for (const note of notes) {
            expect(note.finger).toBeGreaterThanOrEqual(1);
            expect(note.finger).toBeLessThanOrEqual(5);
            expect(note.hand).toBe("right");
        }
    });

    it("fingers a chord's notes distinctly, so a colour per finger reads as a shape", () => {
        const notes = performanceOf([step(0, [60, 64, 67])]);
        expect(new Set(notes.map((note) => note.finger)).size).toBe(3);
    });

    it("fingers a take nobody wrote down, splitting the hands at middle C", () => {
        const played = fingeredFreely([
            { pitch: 48, startMs: 0, durationMs: 400, velocity: 80 },
            { pitch: 64, startMs: 0, durationMs: 400, velocity: 80 },
            { pitch: 67, startMs: 400, durationMs: 400, velocity: 80 },
        ]);
        expect(played.map((note) => note.hand)).toEqual(["left", "right", "right"]);
        for (const note of played) {
            expect(note.finger).toBeGreaterThanOrEqual(1);
        }
    });

    it("leaves a performance that already knows its fingers alone", () => {
        const scored = performanceOf([step(0, [60])]);
        expect(fingeredFreely(scored)).toEqual(scored);
    });
});
