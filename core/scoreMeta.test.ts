// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "../app/adapters/domXmlCodec";
import { readScoreMeta, readScoreMetaFromText } from "./scoreMeta";

const score = (title: string, composer = "", beats = 4, tempo = 90) =>
    `<?xml version="1.0"?><score-partwise><work><work-title>${title}</work-title></work>` +
    `<identification><creator type="composer">${composer}</creator></identification>` +
    `<part><measure><attributes><time><beats>${beats}</beats></time></attributes>` +
    `<sound tempo="${tempo}"/></measure></part></score-partwise>`;

const xml = (title = "Test", beats = 4): string =>
    `<?xml version="1.0"?><score-partwise><work><work-title>${title}</work-title></work><identification><creator type="composer">Bach</creator></identification><part id="P1"><measure number="1"><attributes><time><beats>${beats}</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

describe("readScoreMeta (codec path)", () => {
    it("reads title, composer and meter from the MusicXML", () => {
        const meta = readScoreMeta(domXmlCodec, xml("Minuet", 3));
        expect(meta.title).toBe("Minuet");
        expect(meta.composer).toBe("Bach");
        expect(meta.beatsPerBar).toBe(3);
        expect(meta.tempo).toBe(90); // no <sound tempo>, so the default
    });

    it("reads an explicit tempo from <sound>", () => {
        const withTempo = xml().replace(
            "</work>",
            '</work><part><measure><sound tempo="120"/></measure></part>',
        );
        expect(readScoreMeta(domXmlCodec, withTempo).tempo).toBe(120);
    });

    it("defaults a non-numeric sound tempo rather than emitting NaN", () => {
        const meta = readScoreMeta(
            domXmlCodec,
            '<?xml version="1.0"?><score-partwise><sound tempo="andante"/></score-partwise>',
        );
        expect(meta.tempo).toBe(90);
    });

    it("falls back to Untitled and 4/4 when the metadata is absent", () => {
        const meta = readScoreMeta(domXmlCodec, "<score-partwise><part/></score-partwise>");
        expect(meta.title).toBe("Untitled");
        expect(meta.composer).toBe("");
        expect(meta.beatsPerBar).toBe(4);
    });

    it("falls back to the text pass when the document does not parse at all", () => {
        // Malformed XML: the codec answers null, and the regex pass still salvages
        // the title so an import shows something better than a crash.
        const broken = "<score-partwise><work-title>Salvage</work-title><unclosed";
        expect(readScoreMeta(domXmlCodec, broken).title).toBe("Salvage");
    });

    it("agrees with the text pass on a well-formed document", () => {
        // The prerender reads through the text pass and the client through the
        // codec; a bundled page's title must not depend on which one ran.
        const doc = score("Rock &amp; Roll", "Saint-Sa&#235;ns", 3, 132);
        expect(readScoreMeta(domXmlCodec, doc)).toEqual(readScoreMetaFromText(doc));
    });
});

describe("readScoreMetaFromText (regex/prerender path)", () => {
    it("decodes XML entities in the title and composer", () => {
        const meta = readScoreMetaFromText(score("Rock &amp; Roll", "Saint-Sa&#235;ns"));
        expect(meta.title).toBe("Rock & Roll");
        expect(meta.composer).toBe("Saint-Saëns");
    });

    it("decodes hex, decimal, and angle-bracket entities", () => {
        expect(readScoreMetaFromText(score("&#xe9; &lt;3")).title).toBe("é <3");
        expect(readScoreMetaFromText(score("A &#38; B")).title).toBe("A & B");
    });

    it("resolves each entity once (an escaped entity stays literal)", () => {
        // "&amp;lt;" is the escaped text "&lt;", not the character "<".
        expect(readScoreMetaFromText(score("a &amp;lt; b")).title).toBe("a &lt; b");
    });

    it("reads tempo and meter, falling back when absent", () => {
        expect(readScoreMetaFromText(score("X", "", 3, 120))).toMatchObject({
            tempo: 120,
            beatsPerBar: 3,
        });
        expect(readScoreMetaFromText("<score-partwise/>")).toMatchObject({
            title: "Untitled",
            tempo: 90,
            beatsPerBar: 4,
        });
    });
});
