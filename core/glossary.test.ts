// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_VELOCITY } from "./expression";
import {
    CATEGORIES,
    entriesIn,
    entryById,
    GLOSSARY,
    GLOSSARY_TEMPO,
    performSnippet,
    snippetSeconds,
} from "./glossary";
import { buildSnippet, DIVISIONS, noteDivisions, type Snippet, snippetMidi } from "./glossaryScore";

const bar = (notes: Snippet["notes"], over: Partial<Snippet> = {}): Snippet => ({
    clef: "treble",
    fifths: 0,
    beatsPerBar: 4,
    notes,
    ...over,
});

describe("performSnippet", () => {
    it("clips a staccato note to half its written length", () => {
        // Against the WRITTEN length, not against a plain note: a plain note is played with
        // a small lift of its own, and comparing the two would tie this assertion to a
        // decision about unmarked notes that has nothing to do with staccato.
        const written = 60 / GLOSSARY_TEMPO;
        const clipped = performSnippet(
            bar([{ step: "C", octave: 5, value: "quarter", articulation: "staccato" }]),
        );

        expect(clipped[0]?.duration).toBeCloseTo(written / 2);
    });

    it("strikes an accented note harder", () => {
        const [accented] = performSnippet(
            bar([{ step: "C", octave: 5, value: "quarter", accent: true }]),
        );

        expect(accented?.velocity).toBeGreaterThan(DEFAULT_VELOCITY);
    });

    it("takes a rest's time without sounding it", () => {
        const strikes = performSnippet(
            bar([
                { step: "C", octave: 5, value: "quarter" },
                { step: null, value: "quarter" },
                { step: "G", octave: 4, value: "quarter" },
            ]),
        );

        expect(strikes).toHaveLength(2);
        // The second note waits out the rest rather than following straight on.
        const beat = 60 / GLOSSARY_TEMPO;
        expect(strikes[1]?.delay).toBeCloseTo(2 * beat);
    });

    it("sounds a tie once, held for both notes", () => {
        const strikes = performSnippet(
            bar([
                { step: "G", octave: 4, value: "quarter", tie: "start" },
                { step: "G", octave: 4, value: "quarter", tie: "stop" },
            ]),
        );

        expect(strikes).toHaveLength(1);
        // Both notes' time, less the small lift every unmarked note is played with.
        expect(strikes[0]?.duration).toBeCloseTo(2 * (60 / GLOSSARY_TEMPO) * 0.94);
    });

    it("carries a dynamic down the phrase until another replaces it", () => {
        const strikes = performSnippet(
            bar([
                { step: "C", octave: 5, value: "quarter", dynamic: "p" },
                { step: "D", octave: 5, value: "quarter" },
                { step: "E", octave: 5, value: "quarter", dynamic: "f" },
                { step: "F", octave: 5, value: "quarter" },
            ]),
        );

        expect(strikes[1]?.velocity).toBe(strikes[0]?.velocity);
        expect(strikes[3]?.velocity).toBe(strikes[2]?.velocity);
        expect(strikes[2]?.velocity).toBeGreaterThan(strikes[0]?.velocity ?? 0);
    });

    it("sounds the key signature's sharp without it being written on the note", () => {
        const [struck] = performSnippet(
            bar([{ step: "F", octave: 5, value: "quarter" }], { fifths: 1 }),
        );

        expect(struck?.note).toBe(78);
    });
});

describe("the glossary catalogue", () => {
    it("gives every entry a unique id", () => {
        expect(new Set(GLOSSARY.map((entry) => entry.id)).size).toBe(GLOSSARY.length);
    });

    it("files every entry under a known category, and leaves none empty", () => {
        for (const entry of GLOSSARY) {
            expect(CATEGORIES).toContain(entry.category);
        }
        for (const category of CATEGORIES) {
            expect(entriesIn(category).length).toBeGreaterThan(0);
        }
    });

    it("writes every drawn example to fill its bars exactly", () => {
        // A part-filled final bar renders as a ragged stub, and the bar-splitting
        // assumes no note straddles a barline. Only `shown` is drawn — a plain reading
        // exists to be heard, and is often deliberately shorter (an undotted note is
        // the whole point of the dotted entry's comparison).
        for (const entry of GLOSSARY) {
            const snippet = entry.shown;
            const total = snippet.notes.reduce((sum, note) => sum + noteDivisions(note), 0);
            const barful = snippet.beatsPerBar * DIVISIONS;
            expect(`${entry.id}: ${total % barful}`).toBe(`${entry.id}: 0`);
        }
    });

    it("sounds something for every example", () => {
        for (const entry of GLOSSARY) {
            expect(`${entry.id}: ${performSnippet(entry.shown).length > 0}`).toBe(
                `${entry.id}: true`,
            );
        }
    });

    it("builds renderable MusicXML for every example", () => {
        for (const entry of GLOSSARY) {
            const xml = buildSnippet(entry.shown);
            expect(xml).toContain("<score-partwise");
            expect(xml).toContain('<measure number="1">');
        }
    });

    it("makes the plain reading differ audibly wherever one is offered", () => {
        // The comparison is the whole point of carrying a second reading: if a mark
        // changed nothing you could hear, offering to play it "without" would be a lie.
        for (const entry of GLOSSARY) {
            if (!entry.plain) {
                continue;
            }
            const shown = performSnippet(entry.shown);
            const plain = performSnippet(entry.plain);
            const sameSound =
                shown.length === plain.length &&
                shown.every((strike, index) => {
                    const other = plain[index];
                    return (
                        other !== undefined &&
                        strike.note === other.note &&
                        Math.abs(strike.duration - other.duration) < 0.001 &&
                        // Timing counts: a rest's whole audible difference is that the
                        // note after it arrives later.
                        Math.abs(strike.delay - other.delay) < 0.001 &&
                        strike.velocity === other.velocity
                    );
                });
            expect(`${entry.id} differs: ${!sameSound}`).toBe(`${entry.id} differs: true`);
        }
    });

    it("orders strikes forward in time", () => {
        for (const entry of GLOSSARY) {
            const delays = performSnippet(entry.shown).map((strike) => strike.delay);
            expect(delays).toEqual([...delays].sort((a, b) => a - b));
        }
    });

    it("finds an entry by id, and nothing for an unknown one", () => {
        expect(entryById("staccato")?.category).toBe("touch");
        expect(entryById("nope")).toBeNull();
    });

    it("measures a phrase by its written length, rests included", () => {
        expect(
            snippetSeconds(
                bar([
                    { step: "C", octave: 5, value: "half" },
                    { step: null, value: "half" },
                ]),
            ),
        ).toBeCloseTo(4 * (60 / GLOSSARY_TEMPO));
    });
});

describe("shape notes", () => {
    const entry = GLOSSARY.find((one) => one.id === "shapeNote");

    it("draws a whole octave, so the shapes read as a set", () => {
        // A shape names a degree of the scale, which means one shape on its own says
        // nothing: the explanation is seeing all seven and do arriving back at do.
        const shapes = entry?.shown.notes.map((note) => note.notehead);

        expect(shapes).toEqual(["do", "re", "mi", "fa", "so", "la", "ti", "do"]);
        expect(new Set(shapes).size).toBe(7);
    });

    it("offers no second reading, because a shape changes no sound", () => {
        // The entry the glossary's own rule describes: a mark that instructs the reader
        // rather than the sound gets one reading and a gloss saying what to do with it.
        expect(entry?.plain).toBeNull();
    });

    it("sounds the plain scale it is drawn as", () => {
        // Nothing outside the engraver reads a notehead, so the shapes must not reach the
        // pitches: this has to be an ordinary C major scale to the ear.
        const midi = entry?.shown.notes.map((note) => snippetMidi(note, entry.shown.fifths));

        expect(midi).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    });
});
