// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { categoryOf, gradeOf, MAX_GRADE, parsePositions, rawDifficulty } from "./scoreDifficulty";

// A minimal one-part score builder for the tests.
const score = (notes: string) =>
    `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`;
const note = (step: string, octave: number, staff?: number, chord = false) =>
    `<note>${chord ? "<chord/>" : ""}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration>${staff ? `<staff>${staff}</staff>` : ""}</note>`;

describe("parsePositions", () => {
    it("reads a single-staff line into right-hand positions", () => {
        const { right, left } = parsePositions(score(note("C", 4) + note("E", 4) + note("G", 4)));
        expect(right).toEqual([[60], [64], [67]]);
        expect(left).toEqual([]);
    });

    it("groups a chord into one position and splits the hands by staff", () => {
        const xml = score(
            note("C", 4, 1) + note("E", 4, 1, true) + note("G", 4, 1, true) + note("C", 2, 2),
        );
        const { right, left } = parsePositions(xml);
        expect(right).toEqual([[60, 64, 67]]);
        expect(left).toEqual([[36]]);
    });

    it("skips rests and survives malformed XML", () => {
        expect(parsePositions("not xml at all")).toEqual({ right: [], left: [] });
        const withRest = score(`${note("C", 4)}<note><rest/><duration>2</duration></note>`);
        expect(parsePositions(withRest).right).toEqual([[60]]);
    });
});

describe("rawDifficulty", () => {
    it("is zero for an empty or unreadable score", () => {
        expect(rawDifficulty("garbage")).toBe(0);
        expect(rawDifficulty(score(""))).toBe(0);
    });

    it("costs a comfortable five-finger line less than a wide, leaping one", () => {
        const inHand = score([60, 62, 64, 65, 67].map((p) => noteFor(p)).join(""));
        const leaping = score([60, 72, 64, 76, 67].map((p) => noteFor(p)).join(""));
        expect(rawDifficulty(inHand)).toBeLessThan(rawDifficulty(leaping));
    });
});

describe("categoryOf", () => {
    it("reads the category from the catalogue id", () => {
        expect(categoryOf("scale-c-major")).toBe("scale");
        expect(categoryOf("arpeggio-a-minor")).toBe("arpeggio");
        expect(categoryOf("ode-to-joy")).toBe("piece");
    });
});

describe("gradeOf", () => {
    it("grades a gentle stepwise tune at the bottom of its scale", () => {
        const gentle = score([60, 62, 64, 65, 67].map((p) => noteFor(p)).join(""));
        expect(gradeOf("gentle-piece", gentle)).toBe(1);
    });

    it("always returns a grade within 1..MAX_GRADE", () => {
        // A relentless wide-leap line is the hardest a piece can be.
        const brutal = score([36, 84, 40, 80, 45, 76, 48].map((p) => noteFor(p)).join(""));
        const grade = gradeOf("brutal-piece", brutal);
        expect(grade).toBeGreaterThanOrEqual(1);
        expect(grade).toBeLessThanOrEqual(MAX_GRADE);
    });

    it("grades a harder line at least as high as an easier one in the same category", () => {
        const easy = score([60, 62, 64].map((p) => noteFor(p)).join(""));
        const hard = score([60, 76, 62, 79].map((p) => noteFor(p)).join(""));
        expect(gradeOf("easy-piece", easy)).toBeLessThanOrEqual(gradeOf("hard-piece", hard));
    });
});

// Build a <note> from a MIDI pitch (C major only, enough for the test pitches).
function noteFor(midi: number): string {
    const names = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
    const step = names[midi % 12] ?? "C";
    const octave = Math.floor(midi / 12) - 1;
    return `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration></note>`;
}
