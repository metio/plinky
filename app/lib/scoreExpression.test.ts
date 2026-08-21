// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { playOrder, readScoreExpression } from "./scoreExpression";

// The reader works by shape, so plain objects shaped like OSMD's Note stand in for
// the real thing — no OSMD instance or DOM needed.
const note = (over: Record<string, unknown> = {}) => ({
    Length: { RealValue: 0.25 }, // a quarter note (a whole note is 1)
    ParentVoiceEntry: { Articulations: [] as { articulationEnum: number }[] },
    NoteSlurs: [] as unknown[],
    NoteTie: null,
    ...over,
});

describe("readScoreExpression articulations", () => {
    it("reads a plain note as full length, no marks, struck", () => {
        const expr = readScoreExpression(note());
        expect(expr).toMatchObject({
            strike: true,
            notatedQuarters: 1,
            soundQuarters: 1,
            articulation: "none",
            accent: false,
            marcato: false,
        });
    });

    it("maps the articulation enum to the length articulation", () => {
        const art = (code: number) =>
            readScoreExpression(
                note({ ParentVoiceEntry: { Articulations: [{ articulationEnum: code }] } }),
            ).articulation;
        expect(art(6)).toBe("staccato");
        expect(art(7)).toBe("staccatissimo");
        expect(art(9)).toBe("tenuto");
        expect(art(25)).toBe("detachedLegato");
    });

    it("reads accent and marcato (strong accent) flags", () => {
        const accent = readScoreExpression(
            note({ ParentVoiceEntry: { Articulations: [{ articulationEnum: 0 }] } }),
        );
        expect(accent.accent).toBe(true);
        expect(accent.marcato).toBe(false);
        const marcato = readScoreExpression(
            note({ ParentVoiceEntry: { Articulations: [{ articulationEnum: 1 }] } }),
        );
        expect(marcato.marcato).toBe(true);
    });
});

// The slur tests that stood here are gone with the reader they tested. An arch is a span
// now — the engraving hangs it on its two end notes and nothing between, so no per-note
// read could ever have seen the middle of one — and core/slur.test.ts covers the span.

describe("readScoreExpression ties", () => {
    it("sounds the whole tie at its first note", () => {
        const self: Record<string, unknown> = note();
        self.NoteTie = { StartNote: self, Notes: [self], Duration: { RealValue: 0.5 } };
        const expr = readScoreExpression(self);
        expect(expr.strike).toBe(true);
        expect(expr.soundQuarters).toBe(2); // 0.5 whole notes = two quarters
    });

    it("does not re-strike a tie's continuation note", () => {
        const start = {};
        const cont = note({
            NoteTie: { StartNote: start, Notes: [start], Duration: { RealValue: 0.5 } },
        });
        const expr = readScoreExpression(cont);
        expect(expr.strike).toBe(false);
        // Its own written length still dwells for the cursor's pace.
        expect(expr.notatedQuarters).toBe(1);
    });
});

describe("playOrder", () => {
    const beat = (name: string) => ({ name, IsGraceNote: false });
    const grace = (name: string, entry: object) => ({
        name,
        IsGraceNote: true,
        ParentVoiceEntry: entry,
    });
    const names = (groups: { name: string }[][]) => groups.map((group) => group.map((n) => n.name));

    it("leaves an ordinary position as one group", () => {
        expect(names(playOrder([beat("C"), beat("E")], (n) => n))).toEqual([["C", "E"]]);
    });

    it("plays an ornament before the note it decorates", () => {
        const entry = {};
        expect(names(playOrder([grace("B", entry), beat("C")], (n) => n))).toEqual([["B"], ["C"]]);
    });

    it("separates one ornament from the next but keeps a grace chord together", () => {
        const first = {};
        const second = {};
        const items = [grace("B", first), grace("D", first), grace("E", second), beat("C")];
        expect(names(playOrder(items, (n) => n))).toEqual([["B", "D"], ["E"], ["C"]]);
    });

    it("still ends a position of nothing but ornaments at the beat", () => {
        // The empty on-beat group keeps every walker agreeing on how many steps the
        // position is worth; a collector drops it when it holds nothing playable.
        const entry = {};
        expect(names(playOrder([grace("B", entry)], (n) => n))).toEqual([["B"], []]);
    });

    it("gives an empty position one empty group", () => {
        expect(names(playOrder([], (n) => n))).toEqual([[]]);
    });
});
