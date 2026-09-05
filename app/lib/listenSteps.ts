// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { interpretedWeight } from "../../core/interpretation";
import {
    type ListenNote,
    type ListenStep,
    openingGlissando,
    tremoloAt,
    tremoloCarrier,
    rollChord,
    shapedByContour,
    spellOutGlissando,
    spellOutOrnament,
    spellOutTremolo,
} from "../../core/listenPerformance";
import { fifthsAt, NO_SCORE_MARKS, type ScoreMarks } from "../../core/musicxmlMarks";
import { pedalledAt, ringUntil, softAt } from "../../core/pedal";
import { slurredOnwardAt } from "../../core/slur";
import { readPosition } from "./scorePosition";
import type { TremoloSpan } from "../../core/tremolo";
import { readArpeggio, readOrnament, readParts } from "./scoreExpression";

// Walk the engraved score once and lift the listening timeline into the pure step
// model: every cursor position with its striking notes, the dynamic in force, and
// the lengths for the beat. Leaves the cursor reset. The clock then reads its
// notes from this array, so playback reads no musical data off the live cursor —
// the cursor only mirrors the position and carries the notes the trail colours.
export function collectListenSteps(
    osmd: OpenSheetMusicDisplay,
    // Read from the file rather than off the engraver — see core/musicxmlMarks.
    marks: ScoreMarks = NO_SCORE_MARKS,
): ListenStep[] {
    const cursor = osmd.cursor;
    // Every dynamic the score writes, read once for the walk: a mark stands until the
    // next one, so it belongs to the position's place in the piece, not to the position.
    const _dynamics = marks.dynamics;
    // Where the score asks for the sustain pedal: under it the harmony pools, and a note
    // keeps sounding past its written length until the pedal comes up.
    const pedals = marks.pedals;
    const slurs = marks.slurs;
    // Which notes an ornament reaches for depends on the key it is written in — the key at
    // that point, not the one the piece opened in. A trill after a change of key spelled
    // from the opening signature sounds a note the score does not contain.
    const keys = marks.keys;
    // Which staves belong to the practised instrument — on an art song the piano is staves
    // 1 and 2 and the singer is staff 0, so a hand cannot be read off the raw staff index.
    const parts = readParts(osmd);
    cursor.reset();
    const steps: ListenStep[] = [];
    const rocking: { span: TremoloSpan | null; carrier: ListenNote | null } = {
        span: null,
        carrier: null,
    };
    while (!cursor.iterator.EndReached) {
        const position = readPosition(osmd, parts, marks);
        const { whole, dynamicVolume } = position;
        const groups = position.groups;
        for (const [order, group] of groups.entries()) {
            const notes: ListenNote[] = [];
            const lengths: number[] = [];
            for (const entry of group) {
                const { expression } = entry;
                if (entry.sounds && expression.strike) {
                    notes.push({
                        pitch: entry.pitch,
                        soundQuarters: ringUntil(pedals, whole, expression.soundQuarters / 4) * 4,
                        pedalled: pedalledAt(pedals, whole),
                        articulation: expression.articulation,
                        accent: expression.accent,
                        marcato: expression.marcato,
                        // Whether a slur carries this note onward, judged on its own
                        // staff: an arch over the tune says nothing about the bass.
                        slurred: slurredOnwardAt(slurs, whole, entry.staff),
                        hand: entry.hand,
                    });
                }
                // Rests count too, so a written gap dwells its own length — the cursor
                // advances by the notated rhythm regardless of what sounds.
                lengths.push(expression.notatedQuarters);
            }
            const step: ListenStep = {
                notes,
                dynamicVolume,
                lengths,
                whole,
                measureIndex: position.measureIndex,
                bpm: position.bpm,
                stretch: position.stretch,
                advancesCursor: order === groups.length - 1,
                interpretation: interpretedWeight(marks.bars, slurs, whole),
                // Under the soft pedal the hammers strike fewer strings. Kept separate from
                // the interpretation weight, which is about where a note sits in its bar and
                // its phrase — this is a thing the player's foot is doing, and it applies on
                // top of whatever the music was already asking for.
                soft: softAt(marks.softs, whole),
                // Filled in below, once the whole line is known — a note's height only means
                // something next to its neighbours, and half of them are still ahead.
                contour: 1,
            };
            // A trill, mordent or turn is not a decoration on the note — it is an
            // instruction to play a short figure in its place. Printed but not played, the
            // page and the sound disagree about what the bar contains, and a reader
            // learning to recognise the sign hears nothing happen where it is written.
            const ornament = group.length === 1 ? readOrnament(group[0]?.note) : null;
            // A tremolo and a glissando are the same kind of instruction as an ornament —
            // shorthand for a figure — so they are spelled out the same way, and the graded
            // run still asks for the written notes. Taken in this order because a note can
            // carry only one of them, and the tremolo's span is what decides whether this
            // position opens one.
            const tremolo = tremoloAt(marks.tremolos, whole);
            const gliss = openingGlissando(marks.glissandos, whole);
            if (tremolo) {
                // The note carrying the mark is struck where the span opens and holds
                // through the positions inside it, so the figure at each of those is
                // modelled on the one found at the opening.
                const carrier =
                    rocking.span === tremolo ? rocking.carrier : tremoloCarrier(step, tremolo);
                rocking.span = tremolo;
                rocking.carrier = carrier;
                steps.push(...spellOutTremolo(step, tremolo, carrier));
            } else if (gliss) {
                steps.push(...spellOutGlissando(step, gliss, fifthsAt(keys, whole)));
            } else if (ornament) {
                steps.push(...spellOutOrnament(step, ornament, fifthsAt(keys, whole)));
            } else if (group.some((entry) => readArpeggio(entry.note))) {
                steps.push(...rollChord(step));
            } else {
                steps.push(step);
            }
        }
        cursor.next();
    }
    cursor.reset();
    return shapedByContour(steps);
}
