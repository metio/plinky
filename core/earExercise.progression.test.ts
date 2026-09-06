// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { generateProgression, generateQuestion, parseProgression } from "./earExercise";
import { pitchClassOf } from "./theory";

const range = { lowest: 48, highest: 84 };
const rng = () => 0.5;

describe("a piece's progression in the ear drill", () => {
    it("plays a fixed progression as given, in the key asked for", () => {
        const question = generateProgression(
            {
                degrees: ["I", "IV", "V"],
                length: 4,
                ...range,
                fixed: ["I", "V", "vi", "IV"],
                tonicClass: 7,
            },
            rng,
        );
        expect(question.sequence).toEqual(["I", "V", "vi", "IV"]);
        expect(question.answer).toBe("I-V-vi-IV");
        // The first chord is the tonic triad, on G.
        const opening = question.notes.filter((note) => note.at === 0).map((note) => note.note);
        expect(opening.map(pitchClassOf).sort((a, b) => a - b)).toEqual([2, 7, 11]);
        expect(Math.min(...opening)).toBeGreaterThanOrEqual(range.lowest);
        // The choices offer the piece's chords even beyond the level's own.
        expect(question.choices).toEqual(expect.arrayContaining(["I", "IV", "V", "vi"]));
    });

    it("keeps the level's own questions in the piece's key", () => {
        const question = generateQuestion("progressions", 0, rng, { tonicClass: 3 });
        expect(question.kind).toBe("progressions");
        const opening = question.notes.filter((note) => note.at === 0).map((note) => note.note);
        expect(pitchClassOf(Math.min(...opening))).toBe(3);
    });

    it("reads a progression off a link, sevenths as their triads, and refuses nonsense", () => {
        expect(parseProgression("I-V7-vi-IV")).toEqual(["I", "V", "vi", "IV"]);
        expect(parseProgression("ii7 V I")).toEqual(["ii", "V", "I"]);
        expect(parseProgression("I-X")).toBeNull();
        expect(parseProgression("I")).toBeNull();
        expect(parseProgression(null)).toBeNull();
    });
});
