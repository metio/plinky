// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { readDynamics, readScoreExpression } from "./scoreExpression";

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

describe("readDynamics", () => {
    // The measure shape OSMD really produces: the marks hang off the source measures,
    // each measure knowing where it starts, each mark knowing where it sits inside it.
    const sheet = (measures: unknown[]) => ({ sheet: { SourceMeasures: measures } });
    const measure = (start: number, entries: unknown[]) => ({
        AbsoluteTimestamp: { RealValue: start },
        staffLinkedExpressions: [entries],
    });
    const mark = (at: number, volume: number, wedge = false) => ({
        timestamp: { RealValue: at },
        instantaneousDynamic: { MidiVolume: volume },
        startingContinuousDynamic: wedge ? {} : null,
    });

    it("reads every mark as a whole-note position and a loudness", () => {
        const osmd = sheet([measure(0, [mark(0, 28)]), measure(2, [mark(0, 108)])]);
        expect(readDynamics(osmd)).toEqual([
            { whole: 0, volume: 28, ramp: false },
            { whole: 2, volume: 108, ramp: false },
        ]);
    });

    it("places a mark written inside a bar at its own position", () => {
        const osmd = sheet([measure(2, [mark(0.25, 76)])]);
        expect(readDynamics(osmd)[0]?.whole).toBe(2.25);
    });

    it("marks a hairpin so the loudness slides toward the next mark", () => {
        const osmd = sheet([measure(0, [mark(0, 28, true)])]);
        expect(readDynamics(osmd)[0]?.ramp).toBe(true);
    });

    it("gathers the staves together and puts them in printed order", () => {
        // A grand staff marks its dynamic under whichever staff the engraver chose, and
        // means it for both hands.
        const osmd = {
            sheet: {
                SourceMeasures: [
                    {
                        AbsoluteTimestamp: { RealValue: 0 },
                        staffLinkedExpressions: [[mark(0.5, 108)], [mark(0, 28)]],
                    },
                ],
            },
        };
        expect(readDynamics(osmd).map((point) => point.volume)).toEqual([28, 108]);
    });

    it("skips an expression that carries no instantaneous dynamic", () => {
        // A wedge's closing expression, a mood direction: parsed, but not a loudness.
        const osmd = sheet([measure(0, [{ timestamp: { RealValue: 0 } }, mark(0, 76)])]);
        expect(readDynamics(osmd)).toHaveLength(1);
    });

    it("tolerates a staff slot the engraving left empty", () => {
        const osmd = {
            sheet: {
                SourceMeasures: [
                    { AbsoluteTimestamp: { RealValue: 0 }, staffLinkedExpressions: [undefined] },
                ],
            },
        };
        expect(readDynamics(osmd)).toEqual([]);
    });

    it("reports an unmarked score rather than throwing on an odd shape", () => {
        expect(readDynamics(null)).toEqual([]);
        expect(readDynamics({})).toEqual([]);
        expect(
            readDynamics({
                get sheet(): never {
                    throw new Error("boom");
                },
            }),
        ).toEqual([]);
    });
});
