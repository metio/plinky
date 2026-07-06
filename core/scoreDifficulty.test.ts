// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { describe, expect, it } from "vitest";
import { categoryOf, gradeOf, MAX_GRADE, parsePositions, rawDifficulty } from "./scoreDifficulty";

// A minimal one-part score builder for the tests.
const score = (notes: string) =>
    `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`;
const note = (step: string, octave: number, staff?: number, chord = false) =>
    `<note>${chord ? "<chord/>" : ""}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration>${staff ? `<staff>${staff}</staff>` : ""}</note>`;

describe("parsePositions", () => {
    it("reads a single-staff line into right-hand positions", () => {
        const { right, left } = parsePositions(domXmlCodec, score(note("C", 4) + note("E", 4) + note("G", 4)));
        expect(right).toEqual([[60], [64], [67]]);
        expect(left).toEqual([]);
    });

    it("groups a chord into one position and splits the hands by staff", () => {
        const xml = score(
            note("C", 4, 1) + note("E", 4, 1, true) + note("G", 4, 1, true) + note("C", 2, 2),
        );
        const { right, left } = parsePositions(domXmlCodec, xml);
        expect(right).toEqual([[60, 64, 67]]);
        expect(left).toEqual([[36]]);
    });

    it("skips rests and survives malformed XML", () => {
        expect(parsePositions(domXmlCodec, "not xml at all")).toEqual({ right: [], left: [] });
        const withRest = score(`${note("C", 4)}<note><rest/><duration>2</duration></note>`);
        expect(parsePositions(domXmlCodec, withRest).right).toEqual([[60]]);
    });
});

describe("rawDifficulty", () => {
    it("is zero for an empty or unreadable score", () => {
        expect(rawDifficulty(domXmlCodec, "garbage")).toBe(0);
        expect(rawDifficulty(domXmlCodec, score(""))).toBe(0);
    });

    it("costs a comfortable five-finger line less than a wide, leaping one", () => {
        const inHand = score([60, 62, 64, 65, 67].map((p) => noteFor(p)).join(""));
        const leaping = score([60, 72, 64, 76, 67].map((p) => noteFor(p)).join(""));
        expect(rawDifficulty(domXmlCodec, inHand)).toBeLessThan(rawDifficulty(domXmlCodec, leaping));
    });

    it("averages effort per note rather than summing it, so length alone doesn't inflate", () => {
        // The same octave-leap figure repeated: averaged, the per-note effort barely
        // moves however long the line; summing would scale it with the note count.
        const figure = (repeats: number) =>
            score(
                Array.from({ length: repeats }, () => [60, 72])
                    .flat()
                    .map((p) => noteFor(p))
                    .join(""),
            );
        const short = rawDifficulty(domXmlCodec, figure(3)); // 6 notes
        const long = rawDifficulty(domXmlCodec, figure(15)); // 30 notes
        expect(short).toBeGreaterThan(0);
        expect(long).toBeLessThan(short * 2);
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
        expect(gradeOf(domXmlCodec, "gentle-piece", gentle)).toBe(1);
    });

    it("always returns a grade within 1..MAX_GRADE", () => {
        // A relentless wide-leap line is the hardest a piece can be.
        const brutal = score([36, 84, 40, 80, 45, 76, 48].map((p) => noteFor(p)).join(""));
        const grade = gradeOf(domXmlCodec, "brutal-piece", brutal);
        expect(grade).toBeGreaterThanOrEqual(1);
        expect(grade).toBeLessThanOrEqual(MAX_GRADE);
    });

    it("grades a harder line at least as high as an easier one in the same category", () => {
        const easy = score([60, 62, 64].map((p) => noteFor(p)).join(""));
        const hard = score([60, 76, 62, 79].map((p) => noteFor(p)).join(""));
        expect(gradeOf(domXmlCodec, "easy-piece", easy)).toBeLessThanOrEqual(gradeOf(domXmlCodec, "hard-piece", hard));
    });

    it("grades an unmeasurable score at the top, not as the easiest piece", () => {
        // An empty or unreadable import has no fingerable notes, so its cost is 0.
        // Bucketing it at grade 1 would pad the beginner pool with a phantom piece;
        // it belongs out of the way at the ceiling instead.
        expect(gradeOf(domXmlCodec, "empty-import", score(""))).toBe(MAX_GRADE);
        const restsOnly = score(`<note><rest/><duration>4</duration></note>`);
        expect(gradeOf(domXmlCodec, "rests-only-import", restsOnly)).toBe(MAX_GRADE);
        expect(gradeOf(domXmlCodec, "unreadable-import", "not a score at all")).toBe(MAX_GRADE);
    });

    it("grades a chord with more notes than fingers without crashing", () => {
        // Real piano music has 6+ note voicings the bundled exercises never do; the
        // fingering model must still return a grade rather than fail to finger them.
        const bigChord = score(
            note("C", 4) +
                note("E", 4, undefined, true) +
                note("G", 4, undefined, true) +
                note("C", 5, undefined, true) +
                note("E", 5, undefined, true) +
                note("G", 5, undefined, true),
        );
        const grade = gradeOf(domXmlCodec, "big-chord", bigChord);
        expect(grade).toBeGreaterThanOrEqual(1);
        expect(grade).toBeLessThanOrEqual(MAX_GRADE);
    });
});

describe("midiOf reads pitch, accidental and defaults", () => {
    const one = (pitch: string) =>
        parsePositions(domXmlCodec, score(`<note><pitch>${pitch}</pitch><duration>2</duration></note>`))
            .right;

    it("raises a sharp and lowers a flat by a semitone", () => {
        expect(one("<step>C</step><alter>1</alter><octave>4</octave>")).toEqual([[61]]);
        expect(one("<step>D</step><alter>-1</alter><octave>4</octave>")).toEqual([[61]]);
    });

    it("trims whitespace around the step name", () => {
        expect(one("<step> C </step><octave>4</octave>")).toEqual([[60]]);
    });

    it("defaults a missing octave to 4 rather than to 0 or a throw", () => {
        expect(one("<step>C</step>")).toEqual([[60]]);
    });

    it("skips a pitch with no step, and one whose step names no class, without throwing", () => {
        const noStep = `<note><pitch><octave>4</octave></pitch><duration>2</duration></note>`;
        expect(parsePositions(domXmlCodec, score(noStep + note("E", 4))).right).toEqual([[64]]);
        expect(parsePositions(domXmlCodec, score(note("H", 4) + note("E", 4))).right).toEqual([[64]]);
    });
});

describe("parsePositions groups and splits precisely", () => {
    it("trims whitespace around the staff number", () => {
        const xml = score(
            `<note><pitch><step>C</step><octave>2</octave></pitch><duration>2</duration><staff> 2 </staff></note>`,
        );
        expect(parsePositions(domXmlCodec, xml)).toEqual({ right: [], left: [[36]] });
    });

    it("starts a fresh position for a chord marker with nothing before it", () => {
        // A leading <chord/> has no position to join, so it opens one instead of
        // indexing off the end of an empty hand.
        const xml = score(
            `<note><chord/><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>` +
                note("E", 4, undefined, true),
        );
        expect(parsePositions(domXmlCodec, xml).right).toEqual([[60, 64]]);
    });
});

describe("gradeOf caches and averages", () => {
    it("memoises by id, ignoring any later xml for the same id", () => {
        const gentle = score([60, 62, 64, 65, 67].map(noteFor).join(""));
        const brutal = score([36, 84, 40, 80].map(noteFor).join(""));
        const first = gradeOf(domXmlCodec, "cache-probe", gentle);
        // The second call must return the cached grade, not re-grade the brutal score.
        expect(gradeOf(domXmlCodec, "cache-probe", brutal)).toBe(first);
    });

    it("does not bucket a non-empty balanced two-hand score at the ceiling", () => {
        const xml = score(
            note("C", 4, 1) + note("E", 4, 1) + note("C", 2, 2) + note("E", 2, 2),
        );
        expect(gradeOf(domXmlCodec, "balanced", xml)).toBeLessThan(MAX_GRADE);
    });

    it("keeps a long gentle line at grade 1 — length must not inflate the cost", () => {
        const long = score(Array.from({ length: 40 }, (_, i) => noteFor(60 + (i % 5))).join(""));
        expect(gradeOf(domXmlCodec, "long-gentle", long)).toBe(1);
    });

    it("grades a relentless wide-leap piece above grade 1", () => {
        const brutal = score([36, 84, 40, 80, 45, 76, 48, 72].map(noteFor).join(""));
        expect(gradeOf(domXmlCodec, "brutal-probe", brutal)).toBeGreaterThan(1);
    });

    it("grades hard scales and arpeggios above grade 1 on their own scales", () => {
        const wide = score([48, 72, 50, 74, 52, 76].map(noteFor).join(""));
        expect(gradeOf(domXmlCodec, "scale-wide", wide)).toBeGreaterThan(1);
        expect(gradeOf(domXmlCodec, "arpeggio-wide", wide)).toBeGreaterThan(1);
    });
});

// Build a <note> from a MIDI pitch (C major only, enough for the test pitches).
function noteFor(midi: number): string {
    const names = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
    const step = names[midi % 12] ?? "C";
    const octave = Math.floor(midi / 12) - 1;
    return `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>2</duration></note>`;
}
