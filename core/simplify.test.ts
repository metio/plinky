// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { REDUCTIONS, type Reduction } from "./reduction";
import { simplify } from "./simplify";

const codec = domXmlCodec;

// A note, optionally sounding with the one before it and optionally on the lower staff.
const note = (
    step: string,
    octave: number,
    { chord = false, staff = 1, duration = 4 } = {},
): string =>
    `<note>${chord ? "<chord/>" : ""}<pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
    `<duration>${duration}</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff></note>`;

const rest = (staff = 1, duration = 4): string =>
    `<note><rest/><duration>${duration}</duration><voice>${staff}</voice><staff>${staff}</staff></note>`;

const score = (notes: string) =>
    `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`;

type Sounded = { step: string; octave: number; staff: number; chord: boolean };

function sounded(xml: string): Sounded[] {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.querySelectorAll("note")]
        .filter((n) => n.querySelector("rest") === null)
        .map((n) => ({
            step: n.querySelector("step")?.textContent ?? "",
            octave: Number(n.querySelector("octave")?.textContent ?? "0"),
            staff: Number(n.querySelector("staff")?.textContent ?? "1"),
            chord: n.querySelector("chord") !== null,
        }));
}

// Every note element, rests included, in document order — for checking the bar still counts.
const durations = (xml: string): number[] => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.querySelectorAll("note")]
        .filter((n) => n.querySelector("chord") === null)
        .map((n) => Number(n.querySelector("duration")?.textContent ?? "0"));
};

// The rests a reduction wrote, each with the value it will be printed at.
function printedRests(xml: string) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.querySelectorAll("note")]
        .filter((n) => n.querySelector("rest") !== null)
        .map((n) => ({
            duration: n.querySelector("duration")?.textContent,
            type: n.querySelector("type")?.textContent,
            dots: n.querySelectorAll("dot").length,
            actual: n.querySelector("time-modification > actual-notes")?.textContent,
            normal: n.querySelector("time-modification > normal-notes")?.textContent,
            tuplets: [...n.querySelectorAll("notations > tuplet")].map((t) =>
                t.getAttribute("type"),
            ),
            notations: [...(n.querySelector("notations")?.children ?? [])].map((c) => c.tagName),
            order: [...n.children].map((c) => c.tagName),
        }));
}

describe("simplify: a silenced note keeps its printed value", () => {
    const lower = (inner: string) =>
        `<note><pitch><step>C</step><octave>3</octave></pitch>${inner}</note>`;

    it("keeps the dot on a dotted note it turns into a rest", () => {
        const xml = score(
            note("E", 5, { duration: 6 }) +
                lower(
                    "<duration>6</duration><voice>2</voice><type>quarter</type><dot/><staff>2</staff>",
                ) +
                `<note><chord/><pitch><step>G</step><octave>3</octave></pitch><duration>6</duration><voice>2</voice><type>quarter</type><dot/><staff>2</staff></note>`,
        );
        const [rest] = printedRests(simplify(codec, xml, "melody"));
        expect(rest).toMatchObject({ duration: "6", type: "quarter", dots: 1 });
        expect(rest?.order).toEqual(["rest", "duration", "voice", "type", "dot", "staff"]);
    });

    it("keeps a triplet's time modification and bracket on the rest", () => {
        const triplet = (step: string, bracket: string) =>
            lower(
                `<duration>2</duration><voice>2</voice><type>eighth</type>` +
                    `<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>` +
                    `<staff>2</staff><beam number="1">begin</beam>` +
                    `<notations>${bracket}<slur type="start"/><fingering>1</fingering></notations>`,
            ).replace("<step>C</step>", `<step>${step}</step>`);
        const xml = score(
            note("E", 5, { duration: 6 }) +
                triplet("C", `<tuplet type="start" bracket="yes"/>`) +
                triplet("D", "") +
                triplet("E", `<tuplet type="stop"/>`),
        );
        const rests = printedRests(simplify(codec, xml, "melody"));
        expect(rests).toHaveLength(3);
        for (const rest of rests) {
            expect(rest).toMatchObject({ type: "eighth", actual: "3", normal: "2" });
        }
        expect(rests.map((rest) => rest.tuplets)).toEqual([["start"], [], ["stop"]]);
        // Only the bracket survives: a slur or a fingering on silence means nothing, and a
        // notations element left with nothing in it is dropped altogether.
        expect(rests.map((rest) => rest.notations)).toEqual([["tuplet"], [], ["tuplet"]]);
        expect(rests[1]?.order).not.toContain("notations");
        expect(rests[0]?.order).not.toContain("beam");
    });
});

describe("simplify", () => {
    // A four-note chord in the right hand over a two-note chord in the left.
    const chordy = score(
        note("C", 4) +
            note("E", 4, { chord: true }) +
            note("G", 4, { chord: true }) +
            note("C", 5, { chord: true }) +
            note("C", 2, { staff: 2 }) +
            note("G", 2, { chord: true, staff: 2 }),
    );

    it("thins a chord to its outer notes and leaves the frame standing", () => {
        const out = sounded(simplify(codec, chordy, "thinned"));
        expect(out.filter((n) => n.staff === 1).map((n) => `${n.step}${n.octave}`)).toEqual([
            "C4",
            "C5",
        ]);
        expect(out.filter((n) => n.staff === 2).map((n) => `${n.step}${n.octave}`)).toEqual([
            "C2",
            "G2",
        ]);
    });

    it("outlines to the tune on top and the bass underneath", () => {
        const out = sounded(simplify(codec, chordy, "outlined"));
        expect(out.map((n) => `${n.step}${n.octave}`)).toEqual(["C5", "C2"]);
    });

    it("leaves the melody alone and rests the other hand", () => {
        const simplified = simplify(codec, chordy, "melody");
        expect(sounded(simplified).map((n) => `${n.step}${n.octave}`)).toEqual(["C5"]);
        // The left hand is silent, not absent: the bar still has to account for its time.
        const doc = new DOMParser().parseFromString(simplified, "application/xml");
        const rests = [...doc.querySelectorAll("note")].filter((n) => n.querySelector("rest"));
        expect(rests).toHaveLength(1);
        expect(rests[0]?.querySelector("duration")?.textContent).toBe("4");
        expect(rests[0]?.querySelector("staff")?.textContent).toBe("2");
    });

    it("promotes a survivor when the note carrying the chord's length is the one removed", () => {
        // The head is the LOWEST note here, and melody keeps only the highest — so the head
        // goes and the survivor has to stop claiming to follow a note that is no longer there.
        const simplified = simplify(codec, chordy, "melody");
        const kept = sounded(simplified);
        expect(kept).toHaveLength(1);
        expect(kept[0]?.chord).toBe(false);
    });

    it("keeps every bar counting the same length", () => {
        for (const level of REDUCTIONS) {
            expect(durations(simplify(codec, chordy, level)), level).toEqual(durations(chordy));
        }
    });

    it("changes nothing in a piece that is already one note at a time", () => {
        const single = score(note("C", 4) + note("D", 4) + note("E", 4));
        expect(simplify(codec, single, "thinned")).toBe(single);
    });

    it("leaves a rest alone rather than treating it as a note to keep", () => {
        const withRest = score(note("C", 4) + rest() + note("E", 4));
        expect(sounded(simplify(codec, withRest, "thinned")).map((n) => n.step)).toEqual([
            "C",
            "E",
        ]);
    });

    it("does not touch grace notes, which decorate rather than fill", () => {
        const graced = score(
            `<note><grace/><pitch><step>B</step><octave>3</octave></pitch><staff>1</staff></note>` +
                note("C", 4) +
                note("E", 4, { chord: true }) +
                note("G", 4, { chord: true }),
        );
        const out = sounded(simplify(codec, graced, "outlined"));
        expect(out.map((n) => n.step)).toEqual(["B", "G"]);
    });

    it("returns the score untouched when it cannot be parsed", () => {
        expect(simplify(codec, "not xml at all", "melody")).toBe("not xml at all");
    });

    it("is idempotent: reducing a reduction takes nothing more out", () => {
        for (const level of REDUCTIONS as Reduction[]) {
            const once = simplify(codec, chordy, level);
            expect(sounded(simplify(codec, once, level)), level).toEqual(sounded(once));
        }
    });
});
