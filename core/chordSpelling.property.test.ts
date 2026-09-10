// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { spellChord, spellChordPitch, spellChordTone } from "./chordSpelling";
import { alterFor, LETTERS, SEMITONE } from "./notes";
import { CHORD_QUALITIES, chordLetterSteps, chordPitches, pitchClassOf } from "./theory";

const RELATIVE_MINOR = 9;

// A key as the harmony reader states it: the tonic follows from the signature and the mode.
const key = fc
    .record({ fifths: fc.integer({ min: -7, max: 7 }), mode: fc.constantFrom("major", "minor") })
    .map(({ fifths, mode }) => {
        const majorTonic = pitchClassOf(fifths * 7);
        return {
            fifths,
            mode: mode as "major" | "minor",
            tonic: mode === "major" ? majorTonic : pitchClassOf(majorTonic + RELATIVE_MINOR),
        };
    });

const chord = fc.record({
    root: fc.integer({ min: 0, max: 11 }),
    quality: fc.constantFrom(...CHORD_QUALITIES),
    key,
});

const sounds = ({ step, alter }: { step: string; alter: number }) =>
    pitchClassOf((SEMITONE[step] ?? 0) + alter);

describe("spellChord", () => {
    it("spells every tone on a name that sounds it", () => {
        fc.assert(
            fc.property(chord, (one) => {
                const spelled = spellChord(one);
                const pitches = chordPitches(one.root, one.quality).map(pitchClassOf);
                expect(spelled.map(sounds)).toEqual(pitches);
            }),
        );
    });

    it("stacks every tone its own number of letters above the root", () => {
        fc.assert(
            fc.property(chord, (one) => {
                const spelled = spellChord(one);
                const root = LETTERS.indexOf(spelled[0]?.step ?? "C");
                const steps = chordLetterSteps(one.quality);
                expect(spelled.map((tone) => LETTERS.indexOf(tone.step))).toEqual(
                    steps.map((step) => (root + step) % 7),
                );
            }),
        );
    });

    it("never needs more than a double sharp or flat", () => {
        fc.assert(
            fc.property(chord, (one) => {
                for (const tone of spellChord(one)) {
                    expect(Math.abs(tone.alter)).toBeLessThanOrEqual(2);
                }
            }),
        );
    });

    it("puts a chord on one of the key's own degrees on that degree's letter", () => {
        // The steps above the tonic each degree sits at: the major scale, and the natural
        // minor with the raised seventh its dominant borrows, both on the seventh letter.
        const STEPS = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10, 11] };
        const onDegree = fc
            .tuple(key, fc.nat({ max: 7 }), fc.constantFrom("major", "minor", "dominant-seventh"))
            .map(([k, index, quality]) => {
                const steps = STEPS[k.mode];
                const at = index % steps.length;
                return {
                    key: k,
                    root: pitchClassOf(k.tonic + (steps[at] ?? 0)),
                    degree: Math.min(at, 6),
                    quality: quality as "major" | "minor" | "dominant-seventh",
                };
            });
        // The tonic's letter, read off the signature: the one letter it makes sound the tonic.
        const tonicLetter = (k: { tonic: number; fifths: number }) =>
            LETTERS.findIndex(
                (step) =>
                    pitchClassOf((SEMITONE[step] ?? 0) + alterFor(step, k.fifths)) === k.tonic,
            );
        fc.assert(
            fc.property(onDegree, (one) => {
                const root = LETTERS.indexOf(spellChord(one)[0]?.step ?? "C");
                expect(root).toBe((tonicLetter(one.key) + one.degree) % 7);
            }),
        );
    });
});

describe("spellChordTone and spellChordPitch", () => {
    it("sound the pitch they were asked to spell, in the octave that pitch is in", () => {
        fc.assert(
            fc.property(chord, fc.integer({ min: 21, max: 108 }), (one, midi) => {
                expect(sounds(spellChordTone(one, midi))).toBe(pitchClassOf(midi));
                const { step, alter, octave } = spellChordPitch(one, midi);
                expect((octave + 1) * 12 + (SEMITONE[step] ?? 0) + alter).toBe(midi);
            }),
        );
    });
});
