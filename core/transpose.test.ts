// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { describe, expect, it } from "vitest";
import { transposeMusicXml } from "./transpose";

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const note = (step: string, octave: number, alter?: number) =>
    `<note><pitch><step>${step}</step>${
        alter === undefined ? "" : `<alter>${alter}</alter>`
    }<octave>${octave}</octave></pitch><duration>2</duration></note>`;

const score = (notes: string, fifths?: number) => {
    const key =
        fifths === undefined
            ? ""
            : `<attributes><key><fifths>${fifths}</fifths></key></attributes>`;
    return `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${key}${notes}</measure></part></score-partwise>`;
};

// The spelled pitches a score parses to: letter, signed alter, octave, and the MIDI
// number they sound — so a test can assert both the pitch and how it's written.
function pitches(xml: string): Array<{ name: string; midi: number; octave: number }> {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.querySelectorAll("note > pitch")].map((pitch) => {
        const step = pitch.querySelector("step")?.textContent ?? "";
        const octave = Number(pitch.querySelector("octave")?.textContent ?? "0");
        const alter = Number(pitch.querySelector("alter")?.textContent ?? "0");
        return {
            name: `${step}${alter > 0 ? "#".repeat(alter) : "b".repeat(-alter)}`,
            octave,
            midi: (octave + 1) * 12 + (STEP_SEMITONES[step] ?? 0) + alter,
        };
    });
}

const fifthsOf = (xml: string) =>
    Number(
        new DOMParser().parseFromString(xml, "application/xml").querySelector("key fifths")
            ?.textContent ?? "0",
    );

describe("transposeMusicXml", () => {
    it("returns the score untouched at zero semitones", () => {
        const xml = score(note("C", 4));
        expect(transposeMusicXml(domXmlCodec, xml, 0)).toBe(xml);
    });

    it("raises every pitch by the exact semitone count", () => {
        const result = pitches(
            transposeMusicXml(domXmlCodec, score(note("C", 4) + note("G", 4)), 7),
        );
        expect(result.map((p) => p.midi)).toEqual([67, 74]);
    });

    it("lowers pitches when the shift is negative", () => {
        const result = pitches(transposeMusicXml(domXmlCodec, score(note("F", 4)), -5));
        expect(result[0]).toMatchObject({ name: "C", octave: 4, midi: 60 });
    });

    it("spells a step up as a diatonic second, not a repeated letter", () => {
        // C up a major 2nd is D, up a minor 2nd is D♭ — the letter moves either way.
        expect(pitches(transposeMusicXml(domXmlCodec, score(note("C", 4)), 2))[0]?.name).toBe("D");
        expect(pitches(transposeMusicXml(domXmlCodec, score(note("C", 4)), 1))[0]?.name).toBe("Db");
    });

    it("carries the octave when the letter wraps past B", () => {
        expect(pitches(transposeMusicXml(domXmlCodec, score(note("B", 4)), 1))[0]).toMatchObject({
            name: "C",
            octave: 5,
        });
    });

    it("shifts whole octaves", () => {
        expect(pitches(transposeMusicXml(domXmlCodec, score(note("C", 4)), 12))[0]).toMatchObject({
            name: "C",
            octave: 5,
            midi: 72,
        });
    });

    it("transposes existing accidentals along with the rest", () => {
        // F♯4 up a minor third is A4 (natural), preserving the sounding interval.
        const result = pitches(transposeMusicXml(domXmlCodec, score(note("F", 4, 1)), 3));
        expect(result[0]).toMatchObject({ name: "A", midi: 69 });
    });

    it("moves the key signature with the music", () => {
        // C major (0) up a perfect 5th is G major (1 sharp).
        expect(fifthsOf(transposeMusicXml(domXmlCodec, score(note("C", 4), 0), 7))).toBe(1);
        // C major down a perfect 5th (up a 4th in pitch class) is F major (1 flat).
        expect(fifthsOf(transposeMusicXml(domXmlCodec, score(note("C", 4), 0), -7))).toBe(-1);
    });

    it("chooses the enharmonic spelling that keeps the key in range", () => {
        // E major (4 sharps) up a tritone: the augmented 4th would reach 10 sharps,
        // so the diminished 5th (down to 2 flats) is chosen instead.
        const result = transposeMusicXml(domXmlCodec, score(note("E", 4), 4), 6);
        expect(fifthsOf(result)).toBe(-2);
        // The note is respelled to match: E up a diminished 5th is B♭, not A♯.
        expect(pitches(result)[0]?.name).toBe("Bb");
    });

    it("keeps a key an interval with one plain name would push past seven near C", () => {
        // F♯ major down a semitone is F major, not E♯ major with eleven sharps.
        const down = transposeMusicXml(domXmlCodec, score(note("F", 4, 1), 6), -1);
        expect(fifthsOf(down)).toBe(-1);
        expect(pitches(down)[0]?.name).toBe("F");
        // B major up a tone is D♭ major, not C♯ major's seven sharps.
        const up = transposeMusicXml(domXmlCodec, score(note("B", 4), 5), 2);
        expect(fifthsOf(up)).toBe(-5);
        expect(pitches(up)[0]).toMatchObject({ name: "Db", midi: 73, octave: 5 });
        // D major up a major seventh lands on D♭ major too, an octave up.
        const seventh = transposeMusicXml(domXmlCodec, score(note("D", 4), 2), 11);
        expect(fifthsOf(seventh)).toBe(-5);
        expect(pitches(seventh)[0]).toMatchObject({ name: "Db", midi: 73, octave: 5 });
    });

    it("keeps the spelling a piece had when it moves by whole octaves", () => {
        const sharp = score(note("C", 4, 1), 7);
        expect(fifthsOf(transposeMusicXml(domXmlCodec, sharp, 12))).toBe(7);
        expect(pitches(transposeMusicXml(domXmlCodec, sharp, -12))[0]).toMatchObject({
            name: "C#",
            octave: 3,
        });
    });

    it("updates an existing alter element in place when the accidental survives", () => {
        // C♯4 up a major 2nd is D♯4: the note already carries <alter>, so the
        // element is rewritten rather than removed or duplicated.
        const result = transposeMusicXml(domXmlCodec, score(note("C", 4, 1)), 2);
        expect(pitches(result)[0]).toMatchObject({ name: "D#", midi: 63 });
        expect(result.match(/<alter>/g)).toHaveLength(1);
    });

    it("skips a pitch whose step letter isn't musical", () => {
        const xml = score("<note><pitch><step>H</step><octave>4</octave></pitch></note>");
        expect(transposeMusicXml(domXmlCodec, xml, 2)).toContain("<step>H</step>");
    });

    it("leaves rests and unpitched notes alone", () => {
        const xml = score("<note><rest/><duration>4</duration></note>");
        expect(transposeMusicXml(domXmlCodec, xml, 5)).toContain("<rest/>");
    });

    it("returns the input unchanged when it isn't valid XML", () => {
        expect(transposeMusicXml(domXmlCodec, "not xml at all", 3)).toBe("not xml at all");
    });
});

describe("transposeMusicXml chord symbols", () => {
    const harmony = (root: string, rootAlter?: number, bass?: string, bassAlter?: number) =>
        `<harmony><root><root-step>${root}</root-step>${
            rootAlter === undefined ? "" : `<root-alter>${rootAlter}</root-alter>`
        }</root><kind>major</kind>${
            bass === undefined
                ? ""
                : `<bass><bass-step>${bass}</bass-step>${
                      bassAlter === undefined ? "" : `<bass-alter>${bassAlter}</bass-alter>`
                  }</bass>`
        }</harmony>`;

    // Each symbol's root and bass as written: letter, then # or b per alter.
    function symbols(xml: string): Array<{ root: string; bass: string | null }> {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        const spell = (holder: Element | null, tag: string) => {
            if (!holder) {
                return null;
            }
            const step = holder.querySelector(`${tag}-step`)?.textContent ?? "";
            const alter = Number(holder.querySelector(`${tag}-alter`)?.textContent ?? "0");
            return `${step}${alter > 0 ? "#".repeat(alter) : "b".repeat(-alter)}`;
        };
        return [...doc.querySelectorAll("harmony")].map((one) => ({
            root: spell(one.querySelector("root"), "root") ?? "",
            bass: spell(one.querySelector("bass"), "bass"),
        }));
    }

    it("moves a chord symbol with the notes, its bass included", () => {
        // C over E, a major second up, is D over F♯.
        const xml = score(harmony("C", undefined, "E") + note("E", 3) + note("C", 4), 0);
        expect(symbols(transposeMusicXml(domXmlCodec, xml, 2))).toEqual([
            { root: "D", bass: "F#" },
        ]);
    });

    it("spells a symbol into a flat key with flats, the way the notes are", () => {
        // C major up a semitone is D♭ major: G7 over B becomes A♭7 over C.
        const xml = score(harmony("G", undefined, "B") + note("G", 4), 0);
        const moved = transposeMusicXml(domXmlCodec, xml, 1);
        expect(fifthsOf(moved)).toBe(-5);
        expect(symbols(moved)).toEqual([{ root: "Ab", bass: "C" }]);
        expect(pitches(moved)[0]?.name).toBe("Ab");
    });

    it("drops an accidental a symbol no longer needs and adds one it now does", () => {
        // E♭ major up a major third is G major: E♭ over B♭ becomes G over D, and F♯ minor
        // there (a borrowed chord) becomes A♯.
        const xml = score(harmony("E", -1, "B", -1) + harmony("F", 1) + note("E", 4, -1), -3);
        const moved = transposeMusicXml(domXmlCodec, xml, 4);
        expect(fifthsOf(moved)).toBe(1);
        expect(symbols(moved)).toEqual([
            { root: "G", bass: "D" },
            { root: "A#", bass: null },
        ]);
        expect(moved).not.toContain("<bass-alter>");
    });

    it("writes a new alter straight after its step, where MusicXML orders it", () => {
        const moved = transposeMusicXml(domXmlCodec, score(harmony("C", undefined, "E")), 2);
        expect(moved).toContain("<bass-step>F</bass-step><bass-alter>1</bass-alter>");
    });

    it("spells every symbol exactly as the same pitch written as a note", () => {
        // The symbol and the note beside it must never disagree about a name, in any key
        // and by any interval.
        const spellings: Array<[string, number | undefined]> = [
            ["C", undefined],
            ["C", 1],
            ["D", -1],
            ["D", undefined],
            ["E", -1],
            ["E", undefined],
            ["F", undefined],
            ["F", 1],
            ["G", -1],
            ["G", undefined],
            ["A", -1],
            ["A", undefined],
            ["B", -1],
            ["B", undefined],
        ];
        // Every spelling rides in one document per key and interval, each symbol beside
        // its note, so the whole grid is one transposition per pair rather than one per
        // spelling: the i-th symbol and the i-th note were written as the same pitch.
        const pairs = spellings
            .map(([step, alter]) => harmony(step, alter, step, alter) + note(step, 4, alter))
            .join("");
        for (const fifths of [-4, -1, 0, 2, 5]) {
            for (let semitones = -12; semitones <= 12; semitones++) {
                const moved = transposeMusicXml(domXmlCodec, score(pairs, fifths), semitones);
                const written = pitches(moved).map(({ name }) => name);
                expect(written).toHaveLength(spellings.length);
                expect(symbols(moved)).toEqual(written.map((name) => ({ root: name, bass: name })));
            }
        }
    });

    it("keeps a degree's alteration, which is measured from the chord", () => {
        const xml = score(
            `<harmony><root><root-step>C</root-step></root><kind>dominant</kind><degree><degree-value>9</degree-value><degree-alter>-1</degree-alter><degree-type>add</degree-type></degree></harmony>`,
        );
        const moved = transposeMusicXml(domXmlCodec, xml, 2);
        expect(moved).toContain("<degree-alter>-1</degree-alter>");
        expect(symbols(moved)).toEqual([{ root: "D", bass: null }]);
    });

    it("forgets a printed name that belonged to the old root", () => {
        // German editions print B as H; after moving, the step is a different note.
        const xml = score(
            `<harmony><root><root-step text="H">B</root-step></root><kind>major</kind></harmony>`,
        );
        const moved = transposeMusicXml(domXmlCodec, xml, 2);
        expect(moved).not.toContain('text="H"');
        expect(symbols(moved)).toEqual([{ root: "C#", bass: null }]);
    });
});
