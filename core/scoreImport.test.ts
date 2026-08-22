// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { hasPitchedNotes, importTempo, seedTitle, TEMPO_MAX, TEMPO_MIN } from "./scoreImport";
import { NO_TITLE } from "./scoreMeta";

const score = (body: string) =>
    `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${body}</measure></part></score-partwise>`;

const note = "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>";

describe("hasPitchedNotes", () => {
    it("accepts a document with a pitched note in it", () => {
        expect(hasPitchedNotes(domXmlCodec, score(note))).toBe(true);
    });

    it("rejects a score of nothing but rests", () => {
        expect(hasPitchedNotes(domXmlCodec, score("<note><rest/><duration>4</duration></note>"))).toBe(
            false,
        );
    });

    it("rejects what is not a score at all", () => {
        expect(hasPitchedNotes(domXmlCodec, "")).toBe(false);
        expect(hasPitchedNotes(domXmlCodec, "hello")).toBe(false);
        expect(hasPitchedNotes(domXmlCodec, "<score-partwise><part>")).toBe(false);
        expect(hasPitchedNotes(domXmlCodec, '{"notes":[60,62]}')).toBe(false);
    });

    it("takes a note anywhere in the piece, not only the first bar", () => {
        const late =
            `<?xml version="1.0"?><score-partwise><part id="P1">` +
            `<measure number="1"><note><rest/><duration>4</duration></note></measure>` +
            `<measure number="2">${note}</measure></part></score-partwise>`;
        expect(hasPitchedNotes(domXmlCodec, late)).toBe(true);
    });
});

describe("importTempo", () => {
    it("keeps the figure the player typed", () => {
        expect(importTempo("132", 90)).toBe(132);
    });

    it("falls back to the tempo the score is marked at when the box is unusable", () => {
        // The figure the box last showed, so clearing it saves what was there rather than
        // a number from nowhere.
        expect(importTempo("", 72)).toBe(72);
        expect(importTempo("   ", 72)).toBe(72);
        expect(importTempo("andante", 72)).toBe(72);
        expect(importTempo("-40", 72)).toBe(72);
        expect(importTempo("0", 72)).toBe(72);
    });

    it("holds a typed figure to what the control offers", () => {
        // The control's own bounds only constrain its arrows; the box takes anything.
        expect(importTempo("5000", 90)).toBe(TEMPO_MAX);
        expect(importTempo("3", 90)).toBe(TEMPO_MIN);
    });

    it("rounds a fractional tempo, since a saved score carries whole beats a minute", () => {
        expect(importTempo("88.6", 90)).toBe(89);
    });

    it("holds even the fallback to the range, so no score saves an impossible tempo", () => {
        expect(importTempo("", 0)).toBe(TEMPO_MIN);
        expect(importTempo("", Number.NaN)).toBe(TEMPO_MIN);
        expect(importTempo("", 100_000)).toBe(TEMPO_MAX);
    });
});

describe("seedTitle", () => {
    it("hands the box the title the file carries", () => {
        expect(seedTitle("Minuet in G")).toBe("Minuet in G");
    });

    it("leaves the box empty when the file names no work", () => {
        expect(seedTitle(NO_TITLE)).toBe("");
    });
});
