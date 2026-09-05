// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { volumeAt } from "../../core/dynamics";
import { FERMATA_STRETCH, NOMINAL_BPM } from "../../core/elapsed";
import { type Hand, type Hand2, handOfStaff, isPracticedHand } from "../../core/matcher";
import { type ScoreMarks, tempoAt } from "../../core/musicxmlMarks";
import type { ScoreParts } from "../../core/parts";
import {
    isGraceNote,
    playOrder,
    readScoreExpression,
    readTempo,
    type ScoreExpression,
} from "./scoreExpression";

// One cursor position, read once for every walker that lifts the engraving into a step
// model — the graded run, Listen, keep-up. Each used to read the position for itself:
// the fermata over every note, the ornament split, which notes sound and which are the
// practised hand's, the tie, the tempo. A rule added to one walker was silently missing
// from the next, which is how keep-up came to demand a re-strike of every tied note the
// other two had learned to hold.

export type PositionNote = {
    // The engraver's own note, for what a walker reads off it beyond this.
    note: unknown;
    // Whether anything sounds here: a pitched note rather than a rest.
    sounds: boolean;
    // The MIDI pitch, meaningful only where `sounds`.
    pitch: number;
    staff: number | undefined;
    // Which hand plays it, from the staff the engraving puts it on.
    hand: Hand2;
    // Whether it is the practised hand's — the other hand's notes are accompaniment.
    practised: boolean;
    expression: ScoreExpression;
    grace: boolean;
};

export type ScorePosition = {
    // The notated onset in whole notes, and the 0-based bar.
    whole: number;
    measureIndex: number;
    // The dynamic in force, or null where the score marks none.
    dynamicVolume: number | null;
    // A fermata holds whatever is sounding, so it is read across the position.
    fermata: boolean;
    stretch: number;
    // The tempo in force: from the file, so a tempo written mid-bar takes effect where it
    // is written rather than at the barline before it — which is what the engraver could
    // only do — and the engraver's where the file writes none.
    bpm: number;
    // The notes in playing order: an ornament's grace entries first, each its own group,
    // then what falls on the beat.
    groups: PositionNote[][];
};

export function readPosition(
    osmd: OpenSheetMusicDisplay,
    parts: ScoreParts,
    marks: ScoreMarks,
    hand: Hand = "both",
): ScorePosition {
    const cursor = osmd.cursor;
    const whole = cursor.iterator.currentTimeStamp?.RealValue ?? 0;
    const notes = [...cursor.NotesUnderCursor()];
    let fermata = false;
    for (const note of notes) {
        fermata ||= readScoreExpression(note).fermata;
    }
    const groups = playOrder(notes, (note) => note).map((group) =>
        group.map((note): PositionNote => {
            const staff = note.ParentStaff?.idInMusicSheet;
            return {
                note,
                sounds: !note.isRest() && note.halfTone > 0,
                pitch: note.halfTone + 12,
                staff,
                hand: handOfStaff(staff, parts),
                practised: isPracticedHand(staff, hand, parts),
                expression: readScoreExpression(note),
                grace: isGraceNote(note),
            };
        }),
    );
    return {
        whole,
        measureIndex: cursor.iterator.CurrentMeasureIndex,
        dynamicVolume: volumeAt(marks.dynamics, whole),
        fermata,
        stretch: fermata ? FERMATA_STRETCH : 1,
        bpm: tempoAt(marks.tempi, whole) ?? readTempo(cursor.iterator) ?? NOMINAL_BPM,
        groups,
    };
}
