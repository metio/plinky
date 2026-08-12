// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

// A staff that is not five pitched lines, on a part named as a piano — the shape that
// slipped seven guitar and lute pieces into the catalogue, because every other check
// here reads part names and these files say "Piano".
const withStaff = (inner: string): string =>
    `<score-partwise><part-list><score-part id="P0"><part-name>Piano</part-name></score-part></part-list><part id="P0"><measure number="1"><attributes>${inner}</attributes></measure></part></score-partwise>`;

describe("staves a pianist cannot read", () => {
    it("rejects guitar tablature, whatever the part is called", () => {
        const tab = withStaff("<clef><sign>TAB</sign><line>5</line></clef>");
        expect(nonSoloPianoReason(tab)).toBe("tablature");
        expect(nonPianoVocalReason(tab)).toBe("tablature");
    });

    it("rejects jianpu, the same problem in cipher digits", () => {
        expect(nonSoloPianoReason(withStaff("<clef><sign>jianpu</sign></clef>"))).toBe("tablature");
    });

    it("rejects a six-line staff even where the clef says nothing", () => {
        // Tab files carry both; either alone is enough to disqualify the score.
        expect(nonSoloPianoReason(withStaff("<staff-details><staff-lines>6</staff-lines></staff-details>"))).toBe(
            "non-standard-staff",
        );
    });

    it("rejects a staff with no lines at all", () => {
        // An invisible staff: the notes are there and unreadable.
        expect(nonSoloPianoReason(withStaff("<staff-details><staff-lines>0</staff-lines></staff-details>"))).toBe(
            "non-standard-staff",
        );
    });

    it("keeps an ordinary five-line staff", () => {
        const normal = withStaff(
            "<clef><sign>G</sign><line>2</line></clef><staff-details><staff-lines>5</staff-lines></staff-details>",
        );
        expect(nonSoloPianoReason(normal)).toBeNull();
        expect(nonPianoVocalReason(normal)).toBeNull();
    });

    it("keeps a grand staff that declares its five lines twice", () => {
        const grand = withStaff(
            "<staves>2</staves><staff-details number='1'><staff-lines>5</staff-lines></staff-details><staff-details number='2'><staff-lines>5</staff-lines></staff-details>",
        );
        expect(nonSoloPianoReason(grand)).toBeNull();
    });
});

// One part, named Piano, whose staves carry their own labels — how a converted grand
// staff really looks, rather than one part per label.
const pianoWithStaffLabels = (...labels: string[]): string =>
    `<score-partwise><part-list><score-part id="P0"><part-name>Piano</part-name>${labels
        .map((l) => `<score-instrument id="I"><instrument-name>${l}</instrument-name></score-instrument>`)
        .join("")}</score-part></part-list><part id="P0"></part></score-partwise>`;

describe("staff labels are not instruments", () => {
    it("keeps a piano score whose staves are named treble and bass", () => {
        // LilyPond converts a grand staff this way, and reading that "bass" as a bass
        // instrument threw out real piano music — Satie's Gymnopédies among them.
        expect(nonSoloPianoReason(pianoWithStaffLabels("treble", "bass"))).toBeNull();
        expect(nonSoloPianoReason(pianoWithStaffLabels("bass:"))).toBeNull();
        expect(nonSoloPianoReason(pianoWithStaffLabels("right hand", "left"))).toBeNull();
    });

    it("still rejects an actual bass instrument", () => {
        expect(nonSoloPianoReason(pianoWithStaffLabels("Double Bass"))).toBe("ensemble");
        expect(nonSoloPianoReason(pianoWithStaffLabels("Contrabass"))).toBe("ensemble");
        expect(nonSoloPianoReason(score("Bass Guitar"))).toBe("named-instrument");
    });
});
