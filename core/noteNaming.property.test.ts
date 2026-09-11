// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isWhite } from "./keyboardGeometry";
import {
    keyLabelIn,
    minorKeyTextIn,
    type NoteLabels,
    type NoteLetters,
    type NoteWords,
    namingFor,
    noteSymbolIn,
    noteTextIn,
    openingIn,
    pitchLabelIn,
    spokenKeyIn,
    spokenNoteIn,
} from "./noteNaming";
import { NOTE_TEXT, type NoteNameId, noteNameOf, pitchClassOf } from "./theory";

const WORDS: NoteWords = {
    syllables: ["do", "re", "mi", "fa", "sol", "la", "si"],
    sharp: (note) => `${note} sharp`,
    flat: (note) => `${note} flat`,
    spokenSharp: (note) => `${note} sharp`,
};
// The same vocabulary writing its accidentals as the keys do, with signs.
const SIGNS: NoteWords = { ...WORDS, sharp: (note) => `${note}♯`, flat: (note) => `${note}♭` };

const LOCALES = [
    "en",
    "de",
    "nl",
    "fr",
    "es",
    "it",
    "pt",
    "el",
    "pl",
    "nb",
    "da",
    "sv",
    "fi",
    "hr",
    "uk",
    "zh",
    "ja",
    "ko",
    "ro",
    "cs",
    "sk",
    "hu",
    "ru",
    "tr",
    "sr",
    "sq",
    "xx",
];

const key = fc.integer({ min: 0, max: 127 });
const labels = fc.constantFrom<NoteLabels>("all", "c", "solfege", "off");
const letters = fc.constantFrom<NoteLetters>("auto", "b", "h");
const locale = fc.constantFrom(...LOCALES);
const noteId = fc.constantFrom(...(Object.keys(NOTE_TEXT) as NoteNameId[]));

describe("one name per note, whatever the surface", () => {
    it("names a pitch everywhere exactly as the keys print it, for every choice and language", () => {
        // The answer keys, the key-mapping caps and the root pickers print a pitch with
        // noteSymbolIn; sentences write it with noteTextIn; a screen reader hears
        // spokenNoteIn. Each must agree with the key under the player's finger.
        fc.assert(
            fc.property(labels, locale, letters, key, (shown, where, chosen, midi) => {
                const { system } = namingFor(shown, where, chosen);
                const printed = keyLabelIn(midi, shown, system, WORDS);
                if (printed === null) {
                    return;
                }
                const id = noteNameOf(pitchClassOf(midi));
                expect(pitchLabelIn(midi, system, WORDS)).toBe(printed);
                expect(noteSymbolIn(id, system, WORDS)).toBe(printed);
                // A sentence differs only in writing a sign as a word.
                expect(noteTextIn(id, system, SIGNS)).toBe(printed);
                if (isWhite(midi)) {
                    expect(spokenNoteIn(midi, namingFor(shown, where, chosen), WORDS)).toBe(
                        printed,
                    );
                }
            }),
        );
    });

    it("prints every key when every key is asked for, and only C when C is", () => {
        fc.assert(
            fc.property(labels, locale, letters, key, (shown, where, chosen, midi) => {
                const { system } = namingFor(shown, where, chosen);
                const printed = keyLabelIn(midi, shown, system, WORDS);
                const expected =
                    shown === "all" || shown === "solfege" || (shown === "c" && midi % 12 === 0);
                expect(printed !== null).toBe(expected);
            }),
        );
    });

    it("prints letters when letters are chosen and syllables when do re mi is", () => {
        fc.assert(
            fc.property(locale, letters, (where, chosen) => {
                expect(namingFor("all", where, chosen).system).not.toBe("solfege");
                expect(namingFor("solfege", where, chosen).system).toBe("solfege");
            }),
        );
    });

    it("never uses H when B is chosen, nor B for B natural when H is", () => {
        fc.assert(
            fc.property(labels, locale, (shown, where) => {
                const b = namingFor(shown, where, "b").system;
                const h = namingFor(shown, where, "h").system;
                expect(["german", "swedish", "hungarian"]).not.toContain(b);
                expect(h).not.toBe("letters");
            }),
        );
    });
});

describe("spoken names", () => {
    // Every naming a player can arrive at, from every choice in every language.
    const naming = fc
        .tuple(labels, locale, letters)
        .map(([shown, where, chosen]) => namingFor(shown, where, chosen));

    it("says the octave a piano label carries, middle C in the fourth", () => {
        fc.assert(
            fc.property(key, naming, (midi, one) => {
                expect(
                    spokenKeyIn(midi, one, WORDS).endsWith(` ${Math.floor(midi / 12) - 1}`),
                ).toBe(true);
            }),
        );
    });

    it("never speaks a sign, which a screen reader would read as a number or nothing", () => {
        fc.assert(
            fc.property(key, naming, (midi, one) => {
                expect(spokenKeyIn(midi, one, WORDS)).not.toMatch(/[♯♭#]/);
            }),
        );
    });

    it("gives the twelve keys of an octave twelve different spoken names", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 9 }), naming, (octave, one) => {
                const said = Array.from({ length: 12 }, (_, step) =>
                    spokenNoteIn(12 * (octave + 1) + step, one, WORDS),
                );
                expect(new Set(said).size).toBe(12);
            }),
        );
    });

    it("never says a sharp the language's own way beside a B that language reads as B flat", () => {
        // German, Danish, Polish … hear "B" as B flat. Where the player has made it B
        // natural, the key below it must not be called by the suffix that names B flat's
        // neighbour, or two keys share a name.
        fc.assert(
            fc.property(labels, locale, letters, (shown, where, chosen) => {
                const one = namingFor(shown, where, chosen);
                const readsBAsFlat = namingFor("all", where).system !== "letters";
                if (readsBAsFlat && one.system === "letters") {
                    expect(one.spokenSharp).toBe("word");
                }
            }),
        );
    });
});

describe("minor keys and openings", () => {
    it("lower-cases a minor tonic exactly where the naming says so", () => {
        fc.assert(
            fc.property(labels, locale, letters, noteId, (shown, where, chosen, id) => {
                const naming = namingFor(shown, where, chosen);
                const plain = noteTextIn(id, naming.system, WORDS);
                expect(minorKeyTextIn(id, naming, WORDS)).toBe(
                    naming.lowerMinor ? plain.toLowerCase() : plain,
                );
            }),
        );
    });

    it("changes nothing but the first letter, and only in do re mi", () => {
        fc.assert(
            fc.property(fc.string(), locale, (line, where) => {
                expect(openingIn(line, "german", where)).toBe(line);
                const opened = openingIn(line, "solfege", where);
                expect(opened.length).toBe(line.length);
                expect(opened.slice(1)).toBe(line.slice(1));
            }),
        );
    });
});
