// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { isWhite, whiteKeys } from "./keyboardGeometry";
import { HOME_OCTAVE, METHODS, methodOnKey } from "./practiceMethods";

describe("practiceMethods", () => {
    it("gives every method a dose that fits an evening", () => {
        for (const method of METHODS) {
            expect(method.minutes).toBeGreaterThan(0);
            expect(method.minutes).toBeLessThanOrEqual(20);
        }
    });

    it("has no duplicate ids, so the label lookups stay total", () => {
        expect(new Set(METHODS.map((method) => method.id)).size).toBe(METHODS.length);
    });

    it("puts one method on each white key of the octave, in order from C to B", () => {
        expect(HOME_OCTAVE.to - HOME_OCTAVE.from).toBe(11);
        expect(METHODS.map((method) => method.key)).toEqual(
            whiteKeys(HOME_OCTAVE.from, HOME_OCTAVE.to),
        );
        expect(METHODS.map((method) => method.id)).toEqual([
            "chunking",
            "slow",
            "handsApart",
            "hearingFirst",
            "interleaving",
            "spacing",
            "chords",
        ]);
    });

    it("opens a method for exactly the white keys of the octave, over every MIDI note", () => {
        for (let note = 0; note <= 127; note++) {
            const method = methodOnKey(note);
            const onOctave = note >= HOME_OCTAVE.from && note <= HOME_OCTAVE.to;
            expect(method !== undefined).toBe(onOctave && isWhite(note));
            if (method) {
                expect(method.key).toBe(note);
            }
        }
    });

    it("finds every method again from its own key", () => {
        for (const method of METHODS) {
            expect(methodOnKey(method.key)).toBe(method);
        }
    });
});
