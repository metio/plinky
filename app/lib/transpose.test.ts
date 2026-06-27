// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

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
        expect(transposeMusicXml(xml, 0)).toBe(xml);
    });

    it("raises every pitch by the exact semitone count", () => {
        const result = pitches(transposeMusicXml(score(note("C", 4) + note("G", 4)), 7));
        expect(result.map((p) => p.midi)).toEqual([67, 74]);
    });

    it("lowers pitches when the shift is negative", () => {
        const result = pitches(transposeMusicXml(score(note("F", 4)), -5));
        expect(result[0]).toMatchObject({ name: "C", octave: 4, midi: 60 });
    });

    it("spells a step up as a diatonic second, not a repeated letter", () => {
        // C up a major 2nd is D, up a minor 2nd is D♭ — the letter moves either way.
        expect(pitches(transposeMusicXml(score(note("C", 4)), 2))[0]?.name).toBe("D");
        expect(pitches(transposeMusicXml(score(note("C", 4)), 1))[0]?.name).toBe("Db");
    });

    it("carries the octave when the letter wraps past B", () => {
        expect(pitches(transposeMusicXml(score(note("B", 4)), 1))[0]).toMatchObject({
            name: "C",
            octave: 5,
        });
    });

    it("shifts whole octaves", () => {
        expect(pitches(transposeMusicXml(score(note("C", 4)), 12))[0]).toMatchObject({
            name: "C",
            octave: 5,
            midi: 72,
        });
    });

    it("transposes existing accidentals along with the rest", () => {
        // F♯4 up a minor third is A4 (natural), preserving the sounding interval.
        const result = pitches(transposeMusicXml(score(note("F", 4, 1)), 3));
        expect(result[0]).toMatchObject({ name: "A", midi: 69 });
    });

    it("moves the key signature with the music", () => {
        // C major (0) up a perfect 5th is G major (1 sharp).
        expect(fifthsOf(transposeMusicXml(score(note("C", 4), 0), 7))).toBe(1);
        // C major down a perfect 5th (up a 4th in pitch class) is F major (1 flat).
        expect(fifthsOf(transposeMusicXml(score(note("C", 4), 0), -7))).toBe(-1);
    });

    it("chooses the enharmonic spelling that keeps the key in range", () => {
        // E major (4 sharps) up a tritone: the augmented 4th would reach 10 sharps,
        // so the diminished 5th (down to 2 flats) is chosen instead.
        const result = transposeMusicXml(score(note("E", 4), 4), 6);
        expect(fifthsOf(result)).toBe(-2);
        // The note is respelled to match: E up a diminished 5th is B♭, not A♯.
        expect(pitches(result)[0]?.name).toBe("Bb");
    });

    it("leaves rests and unpitched notes alone", () => {
        const xml = score("<note><rest/><duration>4</duration></note>");
        expect(transposeMusicXml(xml, 5)).toContain("<rest/>");
    });

    it("returns the input unchanged when it isn't valid XML", () => {
        expect(transposeMusicXml("not xml at all", 3)).toBe("not xml at all");
    });
});
