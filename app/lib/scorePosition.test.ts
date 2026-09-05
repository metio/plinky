// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { describe, expect, it } from "vitest";
import { NOMINAL_BPM } from "../../core/elapsed";
import { NO_SCORE_MARKS } from "../../core/musicxmlMarks";
import { GRAND_STAFF } from "../../core/parts";
import { readPosition } from "./scorePosition";

type Voice = {
    midi: number;
    staff?: number;
    rest?: boolean;
    held?: boolean;
    grace?: boolean;
    fermata?: boolean;
};

// The slice of an engraver's cursor the reader looks at: the notes under it, the printed
// onset, and the bar.
function at(voices: Voice[], whole = 0.5, bpm?: number): OpenSheetMusicDisplay {
    const notes = voices.map((voice) => {
        const note: Record<string, unknown> = {
            isRest: () => voice.rest === true,
            halfTone: voice.midi - 12,
            ParentStaff: { idInMusicSheet: voice.staff ?? 0 },
            Length: { RealValue: 0.25 },
            ParentVoiceEntry: { Articulations: voice.fermata ? [{ articulationEnum: 10 }] : [] },
        };
        if (voice.grace) {
            note.IsGraceNote = true;
        }
        if (voice.held) {
            note.NoteTie = { Notes: [{}], Duration: { RealValue: 0.5 } };
        }
        return note;
    });
    return {
        cursor: {
            NotesUnderCursor: () => notes,
            iterator: {
                currentTimeStamp: { RealValue: whole },
                CurrentMeasureIndex: 2,
                ...(bpm === undefined ? {} : { CurrentMeasure: { TempoInBPM: bpm } }),
            },
        },
    } as unknown as OpenSheetMusicDisplay;
}

describe("readPosition", () => {
    it("reads where the position is, and the bar", () => {
        const position = readPosition(at([{ midi: 60 }]), GRAND_STAFF, NO_SCORE_MARKS);
        expect(position.whole).toBe(0.5);
        expect(position.measureIndex).toBe(2);
        expect(position.bpm).toBe(NOMINAL_BPM);
    });

    it("tells a rest from a note and names each note's hand", () => {
        const position = readPosition(
            at([
                { midi: 60, staff: 0 },
                { midi: 48, staff: 1 },
                { midi: 0, rest: true },
            ]),
            GRAND_STAFF,
            NO_SCORE_MARKS,
        );
        const [group] = position.groups;
        expect(group?.map((entry) => entry.sounds)).toEqual([true, true, false]);
        expect(group?.map((entry) => entry.hand)).toEqual(["right", "left", "right"]);
        expect(group?.[0]?.pitch).toBe(60);
    });

    it("says which notes are the practised hand's", () => {
        const left = readPosition(
            at([
                { midi: 60, staff: 0 },
                { midi: 48, staff: 1 },
            ]),
            GRAND_STAFF,
            NO_SCORE_MARKS,
            "left",
        );
        expect(left.groups[0]?.map((entry) => entry.practised)).toEqual([false, true]);
        const both = readPosition(at([{ midi: 60, staff: 0 }]), GRAND_STAFF, NO_SCORE_MARKS);
        expect(both.groups[0]?.[0]?.practised).toBe(true);
    });

    it("reads a tie's continuation as not struck", () => {
        const position = readPosition(at([{ midi: 60, held: true }]), GRAND_STAFF, NO_SCORE_MARKS);
        expect(position.groups[0]?.[0]?.expression.strike).toBe(false);
    });

    it("holds the whole position under a fermata on any of its notes", () => {
        const position = readPosition(
            at([{ midi: 60 }, { midi: 64, fermata: true }]),
            GRAND_STAFF,
            NO_SCORE_MARKS,
        );
        expect(position.fermata).toBe(true);
        expect(position.stretch).toBeGreaterThan(1);
    });

    it("puts a grace note in its own group ahead of the beat", () => {
        const position = readPosition(
            at([{ midi: 62, grace: true }, { midi: 60 }]),
            GRAND_STAFF,
            NO_SCORE_MARKS,
        );
        expect(position.groups).toHaveLength(2);
        expect(position.groups[0]?.[0]?.grace).toBe(true);
        expect(position.groups[1]?.[0]?.pitch).toBe(60);
    });

    it("takes the tempo from the file over the engraver's, and the dynamic in force", () => {
        const marks = {
            ...NO_SCORE_MARKS,
            tempi: [{ whole: 0, bpm: 72 }],
            dynamics: [{ whole: 0, volume: 80, ramp: false }],
        };
        const position = readPosition(at([{ midi: 60 }], 0.5, 120), GRAND_STAFF, marks);
        expect(position.bpm).toBe(72);
        expect(position.dynamicVolume).toBe(80);
        expect(readPosition(at([{ midi: 60 }], 0.5, 120), GRAND_STAFF, NO_SCORE_MARKS).bpm).toBe(
            120,
        );
    });
});
