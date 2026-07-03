// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { nonPianoVocalReason, nonSoloPianoReason } from "./scoreInstrument.mts";

// A minimal MusicXML skeleton with the given part names, enough for the instrument
// classifier (which reads part-name / instrument-name).
const score = (...names: string[]): string =>
    `<score-partwise><part-list>${names
        .map((name, i) => `<score-part id="P${i}"><part-name>${name}</part-name></score-part>`)
        .join("")}</part-list>${names.map((_, i) => `<part id="P${i}"></part>`).join("")}</score-partwise>`;

describe("nonPianoVocalReason", () => {
    it("keeps voice + piano art song", () => {
        expect(nonPianoVocalReason(score("Voice", "Piano"))).toBeNull();
        expect(nonPianoVocalReason(score("Soprano", "Piano"))).toBeNull();
    });

    it("keeps a keyboard part annotated with an alternative", () => {
        // "Piano (or Harp)" is one keyboard part, not a harp — the harp token must not
        // knock it out.
        expect(nonPianoVocalReason(score("Voice", "Piano (or Harp)"))).toBeNull();
    });

    it("keeps accompanied choir and other keyboards", () => {
        expect(nonPianoVocalReason(score("Soprano", "Alto", "Tenor", "Bass", "Piano"))).toBeNull();
        expect(nonPianoVocalReason(score("Mezzo-soprano", "Harpsichord"))).toBeNull();
    });

    it("drops a-cappella voices with no keyboard", () => {
        expect(nonPianoVocalReason(score("Soprano", "Alto", "Tenor", "Bass"))).toBe("no-keyboard");
    });

    it("drops any instrumental part alongside the piano", () => {
        expect(nonPianoVocalReason(score("Voice", "Violin", "Piano"))).toBe("ensemble");
        expect(nonPianoVocalReason(score("Flute", "Piano"))).toBe("ensemble");
        expect(nonPianoVocalReason(score("Double Bass", "Piano"))).toBe("ensemble");
    });

    it("drops percussion", () => {
        expect(nonPianoVocalReason("<score><sign>percussion</sign></score>")).toBe("percussion");
    });

    it("is looser than the solo-piano gate, which rejects any voice", () => {
        const voicePiano = score("Voice", "Piano");
        expect(nonSoloPianoReason(voicePiano)).toBe("ensemble");
        expect(nonPianoVocalReason(voicePiano)).toBeNull();
    });
});
