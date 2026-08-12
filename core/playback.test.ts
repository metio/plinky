// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { effectiveTempo, listenStepMs, MIN_STEP_MS } from "./playback";

describe("listenStepMs", () => {
    it("dwells a note for its own length at the tempo", () => {
        // 120bpm: one beat is 500ms.
        expect(listenStepMs([1], 120)).toBe(500); // quarter
        expect(listenStepMs([2], 120)).toBe(1000); // half
        expect(listenStepMs([4], 120)).toBe(2000); // whole
    });

    it("keeps eighths and sixteenths short instead of rounding them up to a beat", () => {
        // The bug this guards: a one-beat floor made every sub-quarter note plod at
        // quarter speed. An eighth must dwell half a beat, a sixteenth a quarter.
        expect(listenStepMs([0.5], 120)).toBe(250);
        expect(listenStepMs([0.25], 120)).toBe(125);
        // And it's genuinely proportional — an eighth is half a quarter's dwell.
        expect(listenStepMs([0.5], 120)).toBe(listenStepMs([1], 120) / 2);
    });

    it("advances at the next onset when hands hold notes of different lengths", () => {
        // A left-hand whole note (4 beats) sounding with a right-hand quarter (1 beat):
        // the next note lands one beat later, when the quarter ends, not four beats later
        // when the whole note ends. Dwelling for the longest here would stall the cursor on
        // the whole note and delay every following right-hand quarter — the reported bug.
        expect(listenStepMs([4, 1], 120)).toBe(500);
        // The order of the voices under the cursor doesn't matter.
        expect(listenStepMs([1, 4], 120)).toBe(500);
        // A whole note over four sixteenths advances a sixteenth at a time.
        expect(listenStepMs([4, 0.25], 120)).toBe(125);
    });

    it("dwells for the shared length of a true chord", () => {
        // Same-length pitches struck together (one hand's chord) advance as one note.
        expect(listenStepMs([1, 1, 1], 120)).toBe(500);
    });

    it("never returns less than the minimum step, even for a very short note at speed", () => {
        // A thirty-second note at 300bpm is 25ms — below the floor.
        expect(listenStepMs([0.125], 300)).toBe(MIN_STEP_MS);
    });

    it("falls back to a single beat when nothing sounds under the cursor", () => {
        expect(listenStepMs([], 120)).toBe(500);
    });

    it("stays finite for a non-positive tempo rather than scheduling forever", () => {
        expect(Number.isFinite(listenStepMs([1], 0))).toBe(true);
        expect(Number.isFinite(listenStepMs([1], -50))).toBe(true);
    });
});

describe("effectiveTempo", () => {
    it("leaves a piece that keeps one tempo at the dial", () => {
        expect(effectiveTempo(80, 120, 120)).toBe(80);
    });

    it("keeps a later mark in proportion to the opening", () => {
        // Written 120 then 60 — half speed — played at a dial of 80: the slow section is
        // 40, so the shape survives wherever the dial is set.
        expect(effectiveTempo(80, 60, 120)).toBe(40);
        expect(effectiveTempo(80, 240, 120)).toBe(160);
    });

    it("refuses to divide by a stopped clock", () => {
        expect(Number.isFinite(effectiveTempo(80, 120, 0))).toBe(true);
    });
});

describe("listenStepMs under a fermata", () => {
    it("waits longer than the written length", () => {
        expect(listenStepMs([1], 60, 2)).toBe(2000);
    });
});
