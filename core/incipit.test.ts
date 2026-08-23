// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { INCIPIT_NOTES, layoutIncipit, readIncipit, sameOpening } from "./incipit";

const codec = domXmlCodec;

const note = (step: string, octave: number, duration = 4, extra = "") =>
    `<note>${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration></note>`;

const score = (measures: string) =>
    `<score-partwise><part id="P1">${measures}</part></score-partwise>`;

const bar = (notes: string, attributes = "<attributes><divisions>4</divisions></attributes>") =>
    `<measure number="1">${attributes}${notes}</measure>`;

describe("readIncipit", () => {
    it("reads the opening bar's melody, with its written lengths", () => {
        const incipit = readIncipit(
            codec,
            score(bar(note("C", 4) + note("D", 4) + note("E", 4, 16))),
        );
        expect(incipit?.clef).toBe("treble");
        expect(incipit?.notes.map((n) => n.quarters)).toEqual([1, 1, 4]);
        // C4 is 4 × 7 + 0 on the diatonic ladder, D4 one step up, E4 two.
        expect(incipit?.notes.map((n) => n.diatonic)).toEqual([28, 29, 30]);
    });

    it("takes the clef the part declares", () => {
        const bass = readIncipit(
            codec,
            score(
                bar(
                    note("C", 3),
                    "<attributes><divisions>4</divisions><clef><sign>F</sign><line>4</line></clef></attributes>",
                ),
            ),
        );
        expect(bass?.clef).toBe("bass");
    });

    it("draws one head per position, not the whole chord", () => {
        const incipit = readIncipit(
            codec,
            score(bar(note("C", 4) + note("E", 4, 4, "<chord/>") + note("G", 4, 4, "<chord/>"))),
        );
        expect(incipit?.notes).toHaveLength(1);
    });

    it("reads the top staff only, so a grand staff shows its melody", () => {
        const incipit = readIncipit(
            codec,
            score(
                bar(
                    `<note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><staff>1</staff></note>` +
                        `<note><pitch><step>C</step><octave>2</octave></pitch><duration>4</duration><staff>2</staff></note>`,
                ),
            ),
        );
        expect(incipit?.notes.map((n) => n.diatonic)).toEqual([4 * 7 + 4]);
    });

    it("carries an accidental the note is written with, clamped to what it can draw", () => {
        const incipit = readIncipit(
            codec,
            score(
                bar(
                    `<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration></note>` +
                        `<note><pitch><step>B</step><alter>-2</alter><octave>4</octave></pitch><duration>4</duration></note>`,
                ),
            ),
        );
        expect(incipit?.notes.map((n) => n.alter)).toEqual([1, -1]);
    });

    it("runs on past a pickup, so a two-note first bar is not the whole mark", () => {
        const incipit = readIncipit(
            codec,
            score(
                `${bar(note("G", 4))}<measure number="2">${note("C", 5) + note("B", 4) + note("A", 4)}</measure>`,
            ),
        );
        expect(incipit?.notes).toHaveLength(4);
    });

    it("stops after the opening phrase rather than reading the page", () => {
        const steps = ["C", "D", "E", "F", "G", "A", "B", "C", "D"];
        const measures = steps
            .map((step, index) => `<measure number="${index + 1}">${note(step, 4)}</measure>`)
            .join("");
        // Four bars that moved, and no more, even though eight notes were asked for.
        expect(readIncipit(codec, score(measures))?.notes).toHaveLength(4);
    });

    it("plays a vamp through rather than spending the mark on it", () => {
        // Gymnopédie No. 1 holds one chord for four bars before the melody arrives. Four
        // noteheads at one height name no piece, so bars that only repeat what is already
        // shown do not count against the four the mark is allowed.
        const vamp = Array.from(
            { length: 4 },
            (_, index) => `<measure number="${index + 1}">${note("F", 4)}</measure>`,
        ).join("");
        const tune = ["G", "A", "B", "C"]
            .map((step, index) => `<measure number="${index + 5}">${note(step, 4)}</measure>`)
            .join("");
        const incipit = readIncipit(codec, score(vamp + tune));
        // The vamp is still drawn — it is how the piece begins — and the theme follows it.
        // Three bars of theme, because the vamp's first bar was the one it did say.
        expect(incipit?.notes.map((one) => one.diatonic)).toEqual([31, 31, 31, 31, 32, 33, 34]);
    });

    it("keeps reading past a bar that is only rests", () => {
        const incipit = readIncipit(
            codec,
            score(
                `${bar("<note><rest/><duration>16</duration></note>")}<measure number="2">${note("A", 4)}</measure>`,
            ),
        );
        expect(incipit?.notes).toHaveLength(1);
    });

    it("stops at the note limit", () => {
        const many = Array.from({ length: 20 }, () => note("C", 4)).join("");
        expect(readIncipit(codec, score(bar(many)))?.notes).toHaveLength(INCIPIT_NOTES);
        expect(readIncipit(codec, score(bar(many)), 3)?.notes).toHaveLength(3);
    });

    it("returns nothing rather than an empty mark when there is nothing to draw", () => {
        expect(readIncipit(codec, "not xml at all")).toBeNull();
        expect(
            readIncipit(codec, score(bar("<note><rest/><duration>16</duration></note>"))),
        ).toBeNull();
        expect(readIncipit(codec, "<score-partwise></score-partwise>")).toBeNull();
    });
});

describe("layoutIncipit", () => {
    it("places the bottom line's note at zero and climbs half a space per step", () => {
        // E4 is the treble staff's bottom line; F4 sits in the space above it.
        const glyphs = layoutIncipit({
            clef: "treble",
            notes: [
                { diatonic: 4 * 7 + 2, alter: 0, quarters: 1 },
                { diatonic: 4 * 7 + 3, alter: 0, quarters: 1 },
            ],
        });
        expect(glyphs.map((g) => g.y)).toEqual([0, 0.5]);
    });

    it("hollows a minim and takes the stem off a semibreve", () => {
        const glyphs = layoutIncipit({
            clef: "treble",
            notes: [
                { diatonic: 30, alter: 0, quarters: 1 },
                { diatonic: 30, alter: 0, quarters: 2 },
                { diatonic: 30, alter: 0, quarters: 4 },
            ],
        });
        expect(glyphs.map((g) => g.hollow)).toEqual([false, true, true]);
        expect(glyphs.map((g) => g.stem)).toEqual([true, true, false]);
    });

    it("gives a note outside the staff its ledger lines", () => {
        const glyphs = layoutIncipit({
            clef: "treble",
            // Middle C sits one ledger line below the treble staff; A5 one above it.
            notes: [
                { diatonic: 4 * 7, alter: 0, quarters: 1 },
                { diatonic: 5 * 7 + 5, alter: 0, quarters: 1 },
                { diatonic: 30, alter: 0, quarters: 1 },
            ],
        });
        expect(glyphs[0]?.ledgers).toEqual([-1]);
        expect(glyphs[1]?.ledgers).toEqual([5]);
        // A note on the staff needs none.
        expect(glyphs[2]?.ledgers).toEqual([]);
    });

    it("colours by letter, so a sharp is coloured as the note it is written on", () => {
        const glyphs = layoutIncipit({
            clef: "treble",
            // B4 sharp is a B on the page, whatever key it sounds.
            notes: [{ diatonic: 4 * 7 + 6, alter: 1, quarters: 1 }],
        });
        expect(glyphs[0]?.letter).toBe(6);
    });
});

describe("sameOpening", () => {
    // The catalogue's own three Für Elise marks. Two spell the second note D sharp, one
    // spells it B flat — the same key under the same finger.
    const BROKEN = "G37sb37s37sb37s37s34s36s35s";
    const GOOD_A = "G37s#36s37s#36s37s34s36s35s";
    const GOOD_B = "G37s#36s37s#36s37s34s36s35s";

    it("hears through an enharmonic spelling", () => {
        // Compared as WRITTEN these disagree on a quarter of the opening; compared as sound
        // they are the same music, which is the question being asked.
        expect(sameOpening(BROKEN, GOOD_A)).toBe(true);
        expect(sameOpening(GOOD_A, GOOD_B)).toBe(true);
    });

    it("keeps two different pieces of one name apart", () => {
        // Bach wrote many things called Menuet, Schubert more than one Ständchen. Title and
        // composer alone would merge them; the opening does not.
        const menuetOne = "G35q36s37s38e37q38s37s36s";
        const menuetTwo = "Gb41q40q39q40q36q36q39q32e";
        expect(sameOpening(menuetOne, menuetTwo)).toBe(false);
    });

    it("says no when there is too little mark to tell", () => {
        // The safe answer: it keeps two rows that might be one piece, where the opposite
        // deletes a piece that is not a duplicate.
        expect(sameOpening("G37s36s", "G37s36s")).toBe(false);
        expect(sameOpening("", "")).toBe(false);
        expect(sameOpening("nonsense", GOOD_A)).toBe(false);
    });

    it("allows the odd disagreement without demanding every note", () => {
        const nearly = "G37s#36s37s#36s37s34s36s40s";
        expect(sameOpening(GOOD_A, nearly)).toBe(true);
    });
});
