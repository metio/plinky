// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { readActiveDynamic, readScoreExpression } from "./scoreExpression";

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
            slurred: false,
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

describe("readScoreExpression slurs", () => {
    it("marks a note slurred when a slur ends on a different note", () => {
        const self = note();
        const expr = readScoreExpression({ ...self, NoteSlurs: [{ EndNote: {} }] });
        expect(expr.slurred).toBe(true);
    });

    it("does not mark the last note of a slur as connecting onward", () => {
        // The slur must end on this very note, so build it then point the slur at itself.
        const self: Record<string, unknown> = note();
        self.NoteSlurs = [{ EndNote: self }];
        expect(readScoreExpression(self).slurred).toBe(false);
    });
});

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

describe("readActiveDynamic", () => {
    it("reads the standing instantaneous dynamic's MIDI volume", () => {
        expect(readActiveDynamic({ ActiveDynamicExpressions: [{ MidiVolume: 80 }] })).toBe(80);
    });

    it("prefers an interpolated wedge value for a crescendo in progress", () => {
        const iterator = {
            CurrentSourceTimestamp: {},
            ActiveDynamicExpressions: [{ MidiVolume: 40 }, { getInterpolatedDynamic: () => 96 }],
        };
        expect(readActiveDynamic(iterator)).toBe(96);
    });

    it("returns null when no dynamic is in force", () => {
        expect(readActiveDynamic({ ActiveDynamicExpressions: [] })).toBeNull();
        expect(readActiveDynamic({})).toBeNull();
    });

    it("falls back to null rather than throwing on an odd shape", () => {
        const throwing = {
            ActiveDynamicExpressions: [
                {
                    get MidiVolume(): number {
                        throw new Error("boom");
                    },
                },
            ],
        };
        expect(readActiveDynamic(throwing)).toBeNull();
    });

    it("skips OSMD's sparse per-staff undefined slots instead of dereferencing them", () => {
        // OSMD keeps ActiveDynamicExpressions staff-indexed: a staff with no dynamic holds
        // an undefined slot. Dereferencing it would throw and drop the real dynamic below.
        expect(
            readActiveDynamic({ ActiveDynamicExpressions: [undefined, { MidiVolume: 80 }] }),
        ).toBe(80);
        expect(readActiveDynamic({ ActiveDynamicExpressions: [undefined, undefined] })).toBeNull();
    });

    it("ignores a wedge's negative out-of-range sentinel instead of muting the note", () => {
        // getInterpolatedDynamic returns −1 before the wedge and −2 after it; treat those as
        // "no value here" and fall through, not as a loudness that clamps velocity to 1.
        const after = {
            CurrentSourceTimestamp: {},
            ActiveDynamicExpressions: [{ getInterpolatedDynamic: () => -2 }, { MidiVolume: 64 }],
        };
        expect(readActiveDynamic(after)).toBe(64);
        const before = {
            CurrentSourceTimestamp: {},
            ActiveDynamicExpressions: [{ getInterpolatedDynamic: () => -1 }],
        };
        expect(readActiveDynamic(before)).toBeNull();
    });
});
