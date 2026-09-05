// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { scoreKind } from "./scoreInstrument.mts";

// A score with the given parts, named the way a real file names them.
const score = (...parts: string[]) =>
    `<?xml version="1.0"?><score-partwise><part-list>` +
    parts
        .map((name, i) => `<score-part id="P${i}"><part-name>${name}</part-name></score-part>`)
        .join("") +
    `</part-list>${parts.map((_, i) => `<part id="P${i}"><measure number="1"/></part>`).join("")}</score-partwise>`;

describe("scoreKind", () => {
    it("calls a lone keyboard part solo piano", () => {
        expect(scoreKind(score("Piano"))).toBe("solo-piano");
        expect(scoreKind(score("Klavier"))).toBe("solo-piano");
        // Two staves of one instrument are still one instrument.
        expect(scoreKind(score("Piano", "Piano"))).toBe("solo-piano");
    });

    it("reads treble and bass staff labels as a piano, not as a bass singer", () => {
        // A converted piano score names its two staves the way LilyPond does.
        expect(scoreKind(score("Treble", "Bass"))).toBe("solo-piano");
    });

    it("separates a singer over a piano from the piano alone", () => {
        // The distinction the catalogue could not make: both pass a gate, and nothing
        // recorded which, so Schubert accompaniments were graded as beginner pieces.
        expect(scoreKind(score("Voice", "Piano"))).toBe("voice-and-piano");
        expect(scoreKind(score("Singstimme", "Klavier"))).toBe("voice-and-piano");
        expect(scoreKind(score("Soprano", "Piano"))).toBe("voice-and-piano");
    });

    it("calls voices with no keyboard a choral reduction", () => {
        expect(scoreKind(score("Soprano", "Alto", "Tenor", "Bass"))).toBe("choral-reduction");
        expect(scoreKind(score("Cantus", "Superius"))).toBe("choral-reduction");
    });

    it("calls anything with another instrument in it other", () => {
        expect(scoreKind(score("Violin", "Piano"))).toBe("other");
        expect(scoreKind(score("Flute"))).toBe("other");
    });

    it("calls an unnamed pile of parts other, and an unnamed pair piano", () => {
        // A grand staff often names nothing at all; three unnamed parts is not one
        // instrument whatever the file forgot to say.
        expect(scoreKind(score("", ""))).toBe("solo-piano");
        expect(scoreKind(score("", "", ""))).toBe("other");
    });

    it("rejects what is not readable as piano at all", () => {
        const tab = `<?xml version="1.0"?><score-partwise><part><measure><attributes><clef><sign>TAB</sign></clef></attributes></measure></part></score-partwise>`;
        expect(scoreKind(tab)).toBe("other");
    });
});
