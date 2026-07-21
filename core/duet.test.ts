// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type AccompanyVoice, accompanimentForGap } from "./duet";

// 120 BPM: 500 ms per quarter, so 2000 ms per whole note — the spacing every
// delay below is a multiple of.
const BPM = 120;

const voices: AccompanyVoice[] = [
    { pitch: 40, whole: -0.25, quarters: 1 }, // a pickup before your first note
    { pitch: 48, whole: 0, quarters: 2 }, // together with your note at whole 0
    { pitch: 50, whole: 0.5, quarters: 1 }, // halfway through the gap
    { pitch: 52, whole: 1, quarters: 1 }, // your next note's onset — the next gap's
];

describe("accompanimentForGap", () => {
    it("sounds a note on your onset with you (delay 0)", () => {
        const plan = accompanimentForGap(voices, 0, 1, false, BPM);
        expect(plan.find((v) => v.pitch === 48)?.delayMs).toBe(0);
    });

    it("spaces a note inside the gap at the live tempo", () => {
        const plan = accompanimentForGap(voices, 0, 1, false, BPM);
        // Half a whole note past your onset → half of 2000 ms.
        expect(plan.find((v) => v.pitch === 50)?.delayMs).toBe(1000);
    });

    it("leaves a note on your next onset for the next gap", () => {
        const plan = accompanimentForGap(voices, 0, 1, false, BPM);
        expect(plan.some((v) => v.pitch === 52)).toBe(false);
    });

    it("drops a note before your onset in a later gap", () => {
        const plan = accompanimentForGap(voices, 0, 1, false, BPM);
        expect(plan.some((v) => v.pitch === 40)).toBe(false);
    });

    it("sweeps a pickup into the first gap, sounding it with your first note", () => {
        const plan = accompanimentForGap(voices, 0, 1, true, BPM);
        expect(plan.find((v) => v.pitch === 40)?.delayMs).toBe(0);
    });

    it("carries the tail of the piece in the final gap (no upper bound)", () => {
        const plan = accompanimentForGap(voices, 1, Number.POSITIVE_INFINITY, false, BPM);
        expect(plan.map((v) => v.pitch)).toEqual([52]);
    });

    it("scales the delay with the tempo — twice as fast halves the wait", () => {
        const slow = accompanimentForGap(voices, 0, 1, false, 60).find((v) => v.pitch === 50);
        const fast = accompanimentForGap(voices, 0, 1, false, 120).find((v) => v.pitch === 50);
        expect(slow?.delayMs).toBe(2000);
        expect(fast?.delayMs).toBe(1000);
    });

    it("holds a note for its written length at the tempo", () => {
        const plan = accompanimentForGap(voices, 0, 1, false, BPM);
        // Two quarters at 500 ms each = 1 s.
        expect(plan.find((v) => v.pitch === 48)?.durationSec).toBe(1);
    });

    it("gives a length-less note an audible quarter-note tail", () => {
        const plan = accompanimentForGap([{ pitch: 60, whole: 0, quarters: 0 }], 0, 1, false, BPM);
        expect(plan[0]?.durationSec).toBe(0.5);
    });
});
