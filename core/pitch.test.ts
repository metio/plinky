// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { midiToFrequency, STEP_SEMITONES } from "./pitch";

describe("midiToFrequency", () => {
    it("anchors A4 (MIDI 69) at 440 Hz", () => {
        expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    });

    it("doubles a frequency an octave up and halves it an octave down", () => {
        expect(midiToFrequency(81)).toBeCloseTo(880, 6);
        expect(midiToFrequency(57)).toBeCloseTo(220, 6);
    });

    it("puts middle C (MIDI 60) near 261.63 Hz", () => {
        expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
    });
});

describe("STEP_SEMITONES", () => {
    it("maps the seven natural letters to their offset above C", () => {
        expect(STEP_SEMITONES).toEqual({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
    });
});
