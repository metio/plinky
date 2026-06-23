// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { getAudioContext, midiToFrequency } from "./audio";

describe("midiToFrequency", () => {
    it("maps A4 (note 69) to 440 Hz", () => {
        expect(midiToFrequency(69)).toBeCloseTo(440);
    });

    it("doubles the frequency an octave up", () => {
        expect(midiToFrequency(81)).toBeCloseTo(880);
    });

    it("halves the frequency an octave down", () => {
        expect(midiToFrequency(57)).toBeCloseTo(220);
    });

    it("maps middle C (note 60) to ~261.63 Hz", () => {
        expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
    });
});

describe("getAudioContext", () => {
    it("returns null when there is no window", () => {
        // The suite runs in the node environment, so `window` is undefined and
        // no AudioContext can be created.
        expect(getAudioContext()).toBeNull();
    });
});
