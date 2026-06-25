// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// readScoreMetaFromText is the branch readScoreMeta takes during the static
// prerender (Node, no DOMParser). It determines every bundled play page's
// crawler-visible title, so its text must match what DOMParser yields on the
// client. Tested directly, since the test env may or may not provide DOMParser.

import { describe, expect, it } from "vitest";
import { readScoreMetaFromText } from "./catalog";

const score = (title: string, composer = "", beats = 4, tempo = 90) =>
    `<?xml version="1.0"?><score-partwise><work><work-title>${title}</work-title></work>` +
    `<identification><creator type="composer">${composer}</creator></identification>` +
    `<part><measure><attributes><time><beats>${beats}</beats></time></attributes>` +
    `<sound tempo="${tempo}"/></measure></part></score-partwise>`;

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
