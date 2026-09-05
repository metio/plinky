// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLatest } from "./useLatest";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useRef, useState } from "react";
import {
    FERMATA_STRETCH,
    NOMINAL_BPM,
    type Position,
    quartersMs,
    writtenOnsetsMs,
} from "../../core/elapsed";
import { graceOnsetsMs } from "../../core/grace";
import { pedalledAt } from "../../core/pedal";
import { volumeAt } from "../../core/dynamics";

// How many notes the practised hand has to play at the cursor. Only whether a position is
// worth stopping at is asked here, so it needs neither dynamics nor timing: seeking is
// about finding a note, not about how it sounds.
function playableAtCursor(osmd: OpenSheetMusicDisplay, hand: Hand, parts: ScoreParts): number {
    let playable = 0;
    for (const note of osmd.cursor.NotesUnderCursor()) {
        if (
            !note.isRest() &&
            note.halfTone > 0 &&
            isPracticedHand(note.ParentStaff?.idInMusicSheet, hand, parts) &&
            readScoreExpression(note).strike
        ) {
            playable += 1;
        }
    }
    return playable;
}
import { lengthScaleOf, velocityOf } from "../../core/expression";
import { interpretedWeight } from "../../core/interpretation";
import { NO_SCORE_MARKS, type ScoreMarks, tempoAt } from "../../core/musicxmlMarks";
import { slurredOnwardAt } from "../../core/slur";
import type { ScoreParts } from "../../core/parts";
import {
    isGraceNote,
    playOrder,
    readParts,
    readScoreExpression,
    readStartTempo,
    readTempo,
} from "../lib/scoreExpression";
import { seekToOrdinal } from "../lib/scoreCursor";
import {
    currentBar,
    expectedPitches,
    type Hand,
    type Hand2,
    handOfStaff,
    type MatcherState,
    type MatchStep,
    matchNote,
    isPracticedHand,
    askedFor,
    startMatch,
    stepRange,
    staffArrivals,
    type UpcomingStep,
    previewIndex,
    upcomingSteps,
    WHOLE_EPSILON,
    jumpsBack,
} from "../../core/matcher";

// How many positions ahead the notes-highway look-ahead surfaces. The panel spans a
// fixed stretch of music, so what fills it is a question about the music rather than a
// count: this is generous enough that a run of semiquavers still reaches the top, and
// the ones that fall off it are dropped without being drawn.
const HIGHWAY_LOOKAHEAD = 32;

// The fields upcomingSteps does not read, so a lookahead can be built from steps and an
// index alone rather than from a run that does not exist.
const EMPTY_STATE: Omit<MatcherState, "steps" | "index"> = {
    hit: [],
    wrong: 0,
    sinceWrong: 0,
    complete: false,
};

export type { Hand } from "../../core/matcher";

// The MIDI pitches at the cursor's position (chords give several; rests and tied
// continuations give none), narrowed to the chosen hand, with the staves they sit
// on, the notated onset, and the longest written length here in quarter notes —
// one entry of the step model the pure matcher runs on. Collecting the hold length
// with the position means the run reads it off the step model, never the live
// cursor, so the cursor stays purely a visual mirror during a run.
// How long the position under the cursor lasts before the next onset: the shortest note
// or rest here, in quarter notes. The shortest is what ends first, and its end is where
// the cursor stops next — the same rule Listen advances by. A position the score gives
// nothing lasts a beat, matching that fallback.
function shortestLength(osmd: OpenSheetMusicDisplay): number {
    let shortest = Number.POSITIVE_INFINITY;
    for (const note of osmd.cursor.NotesUnderCursor()) {
        // A grace note steals its time from its neighbour and advances nothing: the
        // engraver reports it with a length of its own, and counting that as the
        // position's advance made the gap after every ornament read as a repeat jump.
        if (isGraceNote(note)) {
            continue;
        }
        shortest = Math.min(shortest, note.Length.RealValue * 4);
    }
    return Number.isFinite(shortest) ? shortest : 1;
}

// One group of a position: what is struck together there. An ordinary position has a
// single group; a position carrying an ornament has one per grace entry and then the
// notes that fall on the beat.
type StepGroup = Omit<
    MatchStep,
    | "bar"
    | "position"
    | "elapsedMs"
    | "holdMs"
    | "expected"
    | "advancesCursor"
    | "slackMs"
    | "pedalled"
> & {
    expected: { velocity: number | null; soundQuarters: number; writtenQuarters: number }[];
    // The ornament's own written length, for placing it before the beat. Zero on the
    // group that IS the beat.
    graceQuarters: number;
};

// Everything one cursor position contributes: its groups in playing order, and the
// position-level facts the timeline is built from.
type PositionSteps = Omit<Position, "whole"> & { whole: number; groups: StepGroup[] };

function stepsAtCursor(
    osmd: OpenSheetMusicDisplay,
    hand: Hand,
    parts: ScoreParts,
    marks: ScoreMarks,
): PositionSteps {
    const whole = osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0;
    // The dynamic in force at this position, read once: it is a property of where the
    // cursor sits, not of any one note under it.
    const dynamicVolume = volumeAt(marks.dynamics, whole);
    // A fermata belongs to the position too: it holds whatever is sounding, and a rest can
    // carry one. So it is read across everything under the cursor, including the notes the
    // practised hand does not play.
    let fermata = false;
    for (const note of osmd.cursor.NotesUnderCursor()) {
        fermata ||= readScoreExpression(note).fermata;
    }

    const groups: StepGroup[] = [];
    for (const group of playOrder([...osmd.cursor.NotesUnderCursor()], (note) => note)) {
        const pitches: number[] = [];
        // One entry per pitch, in the same order. A note whose staff the engraver does
        // not report reads as the treble, which is where a single-staff piece is played.
        const pitchStaves: number[] = [];
        // Which hand plays each pitch, worked out from the score's parts rather than from
        // the raw staff index — on an art song the piano's staves are 1 and 2.
        const pitchHands: Hand2[] = [];
        // What each pitch is asked for, pushed alongside `pitches` so the two stay
        // aligned. Kept in quarter notes here and turned into milliseconds once the
        // position's tempo is known, which is where the chord's own hold is converted.
        const expected: {
            velocity: number | null;
            soundQuarters: number;
            writtenQuarters: number;
        }[] = [];
        let holdQuarters = 0;
        let graceQuarters = 0;
        for (const note of group) {
            if (note.isRest() || note.halfTone <= 0) {
                continue;
            }
            const staff = note.ParentStaff?.idInMusicSheet;
            if (!isPracticedHand(staff, hand, parts)) {
                continue;
            }
            const expression = readScoreExpression(note);
            // A tie's later notes are the same sound continuing, not a note to play
            // again: the key is already down and the score is asking for it to stay
            // down. Demanding a re-strike contradicts what the page says, and
            // contradicts Listen, which honours the tie — the two would ask for
            // different performances of one bar. A group whose notes are ALL
            // continuations collects no pitches and is dropped, which is right: there
            // is nothing to do there.
            if (!expression.strike) {
                continue;
            }
            pitches.push(note.halfTone + 12);
            // The step's staves are hands — 0 the right, 1 the left — whatever page
            // position the engraver gives the staff: on an art song the piano's staves
            // are 1 and 2, and reported raw both read as the left hand.
            pitchStaves.push(handOfStaff(staff, parts) === "left" ? 1 : 0);
            pitchHands.push(handOfStaff(staff, parts));
            // Each key is asked for on its own terms: its own accent over the standing
            // dynamic, and its own sounding length narrowed by its own articulation. The
            // sounding length, not the written one — a tied minim is held for the tie.
            expected.push({
                velocity:
                    dynamicVolume === null ? null : velocityOf({ ...expression, dynamicVolume }),
                soundQuarters:
                    expression.soundQuarters *
                    lengthScaleOf({
                        articulation: expression.articulation,
                        // From the span: a note in the middle of an arch carries no slur of
                        // its own, and reading it as unslurred would grade a phrase played
                        // legato as one played staccato. On the note's own staff: an arch
                        // over the tune says nothing about the bass under it.
                        slurred: slurredOnwardAt(marks.slurs, whole, staff),
                    }),
                // The same length before articulation narrows it: what this one key is
                // written to last, which is what its hold indicator draws. A whole note
                // under a quaver is the ordinary case for two hands, and one length for
                // the whole position would drain the quaver's fill at the whole note's
                // pace long after that hand had moved on.
                writtenQuarters: expression.soundQuarters,
            });
            // The group's own length is its longest note: how long the position keeps
            // ringing, which is not the same as how long any one key is held.
            holdQuarters = Math.max(holdQuarters, expression.soundQuarters);
            if (isGraceNote(note)) {
                graceQuarters = Math.max(graceQuarters, expression.notatedQuarters);
            }
        }
        groups.push({
            pitches,
            pitchStaves,
            pitchHands,
            staves: [...new Set(pitchStaves)].sort((a, b) => a - b),
            whole,
            holdQuarters,
            expected,
            graceQuarters,
        });
    }

    return {
        whole,
        // The SHORTEST written length here, rests included — the gap to the next onset,
        // the same measure playback advances the cursor by. Only the repeat arithmetic
        // reads it, and only where the printed onsets jump.
        advanceQuarters: shortestLength(osmd),
        // The tempo in force, so a piece that changes speed is measured by the clock it
        // is written against rather than one average for the whole score.
        // From the file, so a tempo written mid-bar takes effect where it is written
        // rather than at the barline before it — which is what the engraver could only do.
        bpm: tempoAt(marks.tempi, whole) ?? readTempo(osmd.cursor.iterator) ?? NOMINAL_BPM,
        stretch: fermata ? FERMATA_STRETCH : 1,
        groups,
    };
}

// Walk the engraved score once and lift it into the pure step model: every
// playable position for the chosen hand, in play order. Leaves the cursor reset.
// Exported so the duet can lift the sitting-out hand's positions the same way,
// reading the identical staff split the run itself matches on.
export function collectMatchSteps(
    osmd: OpenSheetMusicDisplay,
    hand: Hand,
    // The score's markings, read from the file rather than off the engraver. Defaulted so a
    // caller that only wants the notes — the duet's onsets, the sample prefetch's pitches —
    // need not carry a document it has no use for.
    marks: ScoreMarks = NO_SCORE_MARKS,
): MatchStep[] {
    // Which staves are the practised instrument's, worked out from the sheet rather than
    // assumed: on an art song the piano is staves 1 and 2, and staff 0 is the singer.
    const parts = readParts(osmd);
    // Every dynamic the score writes, read once for the walk: a mark stands until the
    // next one, so it is a property of where a position sits rather than of the position.
    // Where the score asks for the sustain pedal, so a passage meant to be pedalled is
    // not read as one played staccato.
    const pedals = marks.pedals;
    osmd.cursor.reset();
    // Every position the performance passes through, playable or not, because elapsed time
    // is only recoverable from a walk with no holes in it: two positions that follow each
    // other here are adjacent in the music, so the gap between their printed onsets is the
    // real gap — except where a repeat jumps, which is exactly what the accumulation is
    // for. Filtering to the playable ones first would leave gaps indistinguishable from
    // jumps.
    const walked: (PositionSteps & { bar: number })[] = [];
    while (!osmd.cursor.iterator.EndReached) {
        walked.push({
            ...stepsAtCursor(osmd, hand, parts, marks),
            bar: osmd.cursor.iterator.CurrentMeasureIndex,
        });
        osmd.cursor.next();
    }
    osmd.cursor.reset();

    const onsets = writtenOnsetsMs(walked);
    const steps: MatchStep[] = [];
    for (const [index, position] of walked.entries()) {
        const { bpm, stretch, groups, bar } = position;
        const beatMs = onsets[index] as number;
        // An ornament is played before the note it decorates, in the space since the
        // previous position — never at the same instant as its principal, which is what
        // one position for both would ask for.
        const ornament = groups.slice(0, -1);
        const graceMs = graceOnsetsMs(
            beatMs,
            onsets[index - 1] ?? beatMs,
            ornament.map((group) => quartersMs(group.graceQuarters, bpm)),
        );

        const atPosition: MatchStep[] = [];
        for (const [order, group] of groups.entries()) {
            if (group.pitches.length === 0) {
                continue;
            }
            const { graceQuarters: _grace, expected, ...rest } = group;
            const onset = graceMs[order] ?? beatMs;
            atPosition.push({
                ...rest,
                bar,
                position: index,
                elapsedMs: onset,
                holdMs: quartersMs(group.holdQuarters * stretch, bpm),
                // An ornament may be crushed in before the beat or leaned on, taking half
                // the value of the note it decorates. The step model places it before the
                // beat; the window is widened to reach the other reading, so a player who
                // leans is not marked late. On the ornament that is the distance it was
                // placed ahead of the beat; on the note it decorates, the half of its own
                // length an appoggiatura would take.
                pedalled: pedalledAt(pedals, position.whole),
                // How the position is weighted for where it sits — read from the printed
                // onset, not the elapsed one, because a bar's stresses are a property of
                // the page and a repeat revisits the same bar.
                interpretation: interpretedWeight(marks.bars, marks.slurs, position.whole),
                slackMs:
                    ornament.length === 0
                        ? 0
                        : order < groups.length - 1
                          ? beatMs - onset
                          : quartersMs(group.holdQuarters * stretch, bpm) / 2,
                // Each key's own asked-for length, on the same clock as the group's.
                expected: expected.map((pitch) => ({
                    velocity: pitch.velocity,
                    holdMs: quartersMs(pitch.soundQuarters * stretch, bpm),
                    writtenHoldMs: quartersMs(pitch.writtenQuarters * stretch, bpm),
                })),
                // Overwritten below for all but the last.
                advancesCursor: true,
            });
        }
        // Only the last step at a position moves the visual cursor on: an ornament and
        // its principal are printed in one place, so the cursor stays there while the
        // player works through them.
        for (const [order, step] of atPosition.entries()) {
            step.advancesCursor = order === atPosition.length - 1;
        }
        steps.push(...atPosition);
    }
    return steps;
}

// The pitches of every playable position for the chosen hand, in play order —
// the same sequence the matcher steps through, so a fingering computed from it
// lines up with the run's progress. Leaves the cursor reset for the caller.
export function collectSteps(osmd: OpenSheetMusicDisplay, hand: Hand = "both"): number[][] {
    return collectMatchSteps(osmd, hand).map((step) => step.pitches);
}

// Step the visual cursor to the next playable position for the hand — rests, and
// the stretches where only the other hand sounds, are skipped exactly the way the
// step collector skipped them.
function advanceCursor(osmd: OpenSheetMusicDisplay, hand: Hand): void {
    const parts = readParts(osmd);
    osmd.cursor.next();
    while (!osmd.cursor.iterator.EndReached && playableAtCursor(osmd, hand, parts) === 0) {
        osmd.cursor.next();
    }
}

// What a correctly-played position reports: the pitches sounded, its index in the
// run, the wall-clock time it was played, and its notated onset in ms at `tempo`
// — enough for free practice (ignore timing) or rhythm grading (compare them).
export type CorrectInfo = {
    pitches: number[];
    ordinal: number;
    // The position's index among the WHOLE piece's playable steps (not just this
    // run's), so per-note visuals — the hidden-notes reveal, ghost markers — can
    // address the engraved note even when the run started mid-piece or loops a
    // section.
    index: number;
    timestamp: number;
    timeMs: number;
    // The note's written length in milliseconds at the run's tempo — how long it
    // is meant to keep sounding, for the hold-duration indicator. Zero when the
    // score marks no length.
    holdMs: number;
    // What the score asks for here, for the expressive reading: the standing dynamic
    // with any accent applied (null when the score marks none), and how long the note
    // is meant to SOUND — the written length narrowed by its articulation, which is
    // what holdMs deliberately is not (the hold indicator shows the written value).
    // What the score asked of each struck pitch, index-aligned with `pitches`: the
    // dynamic with that note's own accent, and how long that key is meant to be down.
    expectedVelocities: (number | null)[];
    expectedHoldsMs: number[];
    // How long each struck key is WRITTEN to last, index-aligned with `pitches` — the
    // hold indicator's own figure, per key rather than per position.
    writtenHoldsMs: number[];
    // How hard each was actually struck, index-aligned with `pitches`.
    velocities: number[];
    // How much the timing windows are widened here — non-zero only around an ornament.
    slackMs: number;
    // The score asks for the pedal here, so how long the keys were down is not evidence
    // of the length being played.
    pedalled: boolean;
    velocity: number;
    // How many wrong notes were played at this position before it was cleared —
    // zero means a clean first try, the signal Flow and per-segment accuracy are
    // built from.
    wrongBefore: number;
    // The staves this position sits on (0 = treble/right, 1 = bass/left), so a run can be
    // scored per hand. Both when a chord spans the grand staff.
    staves: number[];
    // When each staff's part of this position landed, on the same clock as `timestamp`.
    // A position clears on its LAST pitch, so `timestamp` alone says nothing about which
    // hand got there first — and on hands-together music, which is most of it, that
    // difference is the whole of a per-hand verdict.
    staffTimes: Record<number, number>;
};

// Drives note-by-note practice of an OSMD score. The pure matcher in core owns
// what counts as progress; this hook extracts the step model from the engraved
// score, feeds played notes through the reducer, and mirrors its position onto
// the visual cursor and the React state the play surface renders.
export function useScoreMatcher(
    getOsmd: () => OpenSheetMusicDisplay | null,
    options: {
        onCorrect?: (info: CorrectInfo) => void;
        // A section loop has come round again. The run's own state rewinds here, but what
        // the run DREW on the score does not — so the second pass over the same bars starts
        // already coloured green and the trail stops meaning "how far you have got". The
        // surface owns the paint, so it is told rather than reached into.
        onLap?: () => void;
        // A written repeat has sent the run back to bars it has already played. Same
        // problem the lap above solves and the same answer — the second pass over those
        // bars would otherwise start already coloured from the first — but a different
        // event, because a lap is the player choosing to drill a range and a repeat is the
        // score asking. Kept apart so a consumer can answer one without answering both:
        // the lap also bumps the practice tempo, which a repeat must not.
        onRewind?: () => void;
        // A wrong note at a position: its whole-piece step index and how many wrong
        // attempts that position has absorbed so far (1 on the first slip) — what a
        // tries budget compares against.
        onWrong?: (info: { index: number; misses: number }) => void;
        tempo?: number;
        hand?: Hand;
        // The score's markings, read from the file. What a run is graded against — the
        // loudness each note asks for, the arch that holds it, the octave line over it —
        // comes from here rather than from the engraver's object graph.
        marks?: ScoreMarks;
        // Forgiving advance: when the player plays a note belonging to the NEXT position,
        // treat the current one as done (crediting only what they played) and move on, so
        // a slip — especially the wrong hand in a two-hand piece — never freezes the run.
        forgiving?: boolean;
    } = {},
) {
    const [practicing, setPracticing] = useState(false);
    const [expected, setExpected] = useState<number[]>([]);
    // The next few positions to play, for the notes-highway look-ahead — updated
    // wherever `expected` is, so the two never drift.
    const [upcoming, setUpcoming] = useState<UpcomingStep[]>([]);
    const [done, setDone] = useState(0);
    const [total, setTotal] = useState(0);
    const [wrong, setWrong] = useState(0);
    // Whether the player has missed at the current position (drives the "reveal on
    // mistake" hint), and the most recent wrong note with a bump counter so the
    // keyboard re-flashes it even when the same wrong key is hit twice running.
    const [missedHere, setMissedHere] = useState(false);
    const [lastWrong, setLastWrong] = useState<{ note: number; seq: number } | null>(null);
    const [range, setRange] = useState<{ from: number; to: number } | null>(null);
    const [complete, setComplete] = useState(false);
    // The 0-based bar the current position sits in, so a focus view can show the
    // current bars without re-deriving the position from the run count.
    const [bar, setBar] = useState(0);
    const stateRef = useRef<MatcherState | null>(null);
    const wrongSeq = useRef(0);
    const practicingRef = useRef(false);
    const optionsRef = useLatest(options);
    // The tempo is fixed for the duration of a run so that every note's notated
    // time uses one scale. Reading the live tempo instead would let a mid-run
    // slider change rebase later notes against the first note's old tempo and
    // corrupt the timing and flow grades.
    const runTempoRef = useRef(options.tempo ?? 100);
    // The tempo the score opens at, captured with the run for the same reason. Every
    // baked time is at the written tempi, and this is what the dial is read against:
    // asking for 80 asks for the opening at 80, and a later mark keeps its ratio to it.
    // A score that marks no tempo is counted at the nominal one, so the ratio reduces to
    // the dial over that constant and the piece plays at the dial, as it always did.
    const runStartBpmRef = useRef(NOMINAL_BPM);
    // How much faster than written the run is being played.
    const dialRatio = useCallback(
        () => runTempoRef.current / Math.max(1, runStartBpmRef.current),
        [],
    );
    // The hand is fixed for the duration of a run, captured at start, so a change
    // to the selector mid-run can't desync the position count from what's matched.
    const runHandRef = useRef<Hand>(options.hand ?? "both");

    // A section loop confines the run to a bar range and laps it: clearing the range's
    // last position rewinds to its first for another pass, and the run never completes
    // (a drill has no end to grade). Held with the run's steps so a lap can restart
    // the reducer without re-collecting the score.
    const runLoopRef = useRef(false);
    const runStepsRef = useRef<MatchStep[]>([]);
    // Where the run's first step sits among the whole piece's steps, so relative
    // reducer indices translate to the engraved note they belong to.
    // Each run step's index among the whole piece's steps, by ordinal in the run.
    const runIndicesRef = useRef<number[]>([]);

    const stop = useCallback(() => {
        practicingRef.current = false;
        getOsmd()?.cursor?.hide();
        setPracticing(false);
    }, [getOsmd]);

    // The lookahead for a surface that walks the music without grading it — Listen. The
    // notes highway draws whatever is coming next, and "what is coming next" is the same
    // question whoever is asking: the same steps, off the same engraving. Tying it to a
    // graded run instead meant Listen dropped the highway and showed the staff, throwing
    // away the reading mode the player chose.
    //
    // Collecting walks the cursor, so it is done ONCE and then only re-indexed. A walk per
    // sounded note would reset the cursor Listen is steering, and re-read the whole
    // engraving between two beats.
    // Where the lookahead last landed, and the onset it was asked for. Carried because a
    // repeat prints two passes at the same onsets, so "which position is this" cannot be
    // answered from the onset alone — see previewIndex.
    const previewRef = useRef<{
        hand: Hand;
        steps: MatchStep[];
        at: number;
        whole: number;
    } | null>(null);

    // Drop the collected steps: the engraving they were read from is gone (a reload, a
    // transpose), so re-indexing them would point at music no longer on the page.
    const resetPreview = useCallback(() => {
        previewRef.current = null;
    }, []);

    const preview = useCallback(
        (fromWhole: number) => {
            const osmd = getOsmd();
            // A run owns the lookahead while it lasts — it knows where the player actually
            // is, which is not where the notation says the clock is.
            if (!osmd || practicingRef.current) {
                return;
            }
            const hand = optionsRef.current.hand ?? "both";
            if (previewRef.current === null || previewRef.current.hand !== hand) {
                previewRef.current = {
                    hand,
                    steps: collectMatchSteps(osmd, hand, optionsRef.current.marks),
                    at: -1,
                    whole: Number.NEGATIVE_INFINITY,
                };
            }
            const steps = previewRef.current.steps;
            // The position at or after the asked-for onset, so the note now sounding is the
            // first block on the highway — the same place a run's lookahead starts from.
            //
            // Resolved forward from wherever the lookahead last was, not by the first match
            // in the piece: a repeat prints the same onsets twice, and answering from the
            // top drew the pass that had already gone for as long as the repeat lasted.
            const index = previewIndex(
                steps,
                fromWhole,
                previewRef.current.at,
                previewRef.current.whole,
            );
            previewRef.current.at = index;
            previewRef.current.whole = fromWhole;
            setUpcoming(
                upcomingSteps(
                    { ...EMPTY_STATE, steps, index: index < 0 ? steps.length : index },
                    HIGHWAY_LOOKAHEAD,
                ),
            );
        },
        [getOsmd],
    );

    // Begin a run. `fromWhole` — a notated onset in whole notes from the top of the
    // piece — starts partway through, at the first playable position at or after it,
    // so taking over from Listen (or resuming a paused run) continues from the shared
    // cursor position rather than rewinding. The run is graded for what it covers:
    // total and progress count only the positions from here on. The default, 0, starts
    // at note one.
    // The three views a matcher state has on screen: which bar the cursor is in, which
    // pitches are expected now, and what the highway shows coming. They are read from the
    // same state and were written out at each of the three places a state is adopted —
    // where one of them could quietly be left behind, showing a bar from before the last
    // note landed.
    const publish = useCallback((state: MatcherState) => {
        setBar(currentBar(state));
        setExpected(expectedPitches(state));
        setUpcoming(upcomingSteps(state, HIGHWAY_LOOKAHEAD));
    }, []);

    // Where the lookahead is standing, for a caller resuming a run: a printed onset names
    // two places on a repeated piece, and handing over from Listen has to continue on the
    // pass it was on rather than send the player back over bars they just heard.
    const previewAnchor = useCallback(
        () =>
            previewRef.current && previewRef.current.at >= 0
                ? { at: previewRef.current.at, whole: previewRef.current.whole }
                : null,
        [],
    );

    const start = useCallback(
        // `loop` — a 1-based inclusive bar range — overrides the resume point: the run
        // plays only that section and laps it until stopped. `anchor` is where the
        // lookahead stands, so a resume lands on the right pass through a repeat.
        (
            fromWhole = 0,
            loop: { from: number; to: number } | null = null,
            anchor: { at: number; whole: number } | null = null,
        ) => {
            const osmd = getOsmd();
            if (!osmd) {
                return;
            }
            const hand = optionsRef.current.hand ?? "both";
            const all = collectMatchSteps(osmd, hand, optionsRef.current.marks);
            // The first position at or after the resume point; -1 when none remains
            // (the cursor sits past the last note), which leaves nothing to play.
            const startIndex =
                fromWhole > 0
                    ? previewIndex(
                          all,
                          fromWhole,
                          // Only when the lookahead is standing exactly where the resume
                          // asks for. Anywhere else it is left over from a bar somebody
                          // tapped or an earlier listen, and its pass is not this one — so
                          // it is dropped and the search starts from the top, which is what
                          // an unanchored resume should do.
                          anchor && Math.abs(anchor.whole - fromWhole) < WHOLE_EPSILON
                              ? anchor.at
                              : -1,
                          anchor?.whole ?? Number.NEGATIVE_INFINITY,
                      )
                    : 0;
            // Which of the whole piece's steps the run is over, by index into `all`: a
            // section loop over repeated bars keeps both passes, which is not one
            // contiguous slice, so each step's place in the piece is kept beside it.
            const indices = loop
                ? all.flatMap((step, index) =>
                      step.bar >= loop.from - 1 && step.bar <= loop.to - 1 ? [index] : [],
                  )
                : startIndex < 0
                  ? []
                  : all.slice(startIndex).map((_, offset) => startIndex + offset);
            const steps = indices.map((index) => all[index]!);
            // A score with no playable positions (all rests, empty, or resumed past the
            // end) has nothing to match: entering the practicing state would strand the
            // UI at 0/0 forever, since completion is only reached by clearing a position.
            if (steps.length === 0) {
                osmd.cursor.hide();
                return;
            }
            const state = startMatch(steps);
            stateRef.current = state;
            // The collector leaves the cursor reset; walk it to the run's first position —
            // by cursor position, so a resume on the second pass of a repeat lands there
            // rather than on the same bar of the first.
            seekToOrdinal(osmd.cursor, steps[0]!.position);
            osmd.cursor.show();
            runLoopRef.current = loop !== null;
            runStepsRef.current = steps;
            runIndicesRef.current = indices;
            runTempoRef.current = optionsRef.current.tempo ?? 100;
            runStartBpmRef.current =
                tempoAt(optionsRef.current.marks?.tempi ?? [], 0) ??
                readStartTempo(osmd) ??
                NOMINAL_BPM;
            runHandRef.current = hand;
            practicingRef.current = true;
            publish(state);
            setTotal(steps.length);
            setDone(0);
            setWrong(0);
            setMissedHere(false);
            setComplete(false);
            setRange(stepRange(steps));
            setPracticing(true);
        },
        [getOsmd, publish],
    );

    const registerNote = useCallback(
        (note: number, timestamp = performance.now(), velocity = 0) => {
            const osmd = getOsmd();
            const state = stateRef.current;
            if (!practicingRef.current || !osmd || !state || state.complete) {
                return;
            }
            // Keep-going is read live (not captured at start): the fullscreen
            // toggle must take effect on the very next note, mid-run.
            const { state: next, events } = matchNote(
                state,
                note,
                timestamp,
                optionsRef.current.forgiving ?? false,
                velocity,
            );
            stateRef.current = next;
            for (const event of events) {
                if (event.kind === "wrong") {
                    setWrong(next.wrong);
                    setMissedHere(true);
                    wrongSeq.current += 1;
                    setLastWrong({ note: event.note, seq: wrongSeq.current });
                    optionsRef.current.onWrong?.({
                        index: runIndicesRef.current[next.index] ?? 0,
                        misses: next.sinceWrong,
                    });
                    continue;
                }
                if (event.kind !== "cleared") {
                    continue;
                }
                optionsRef.current.onCorrect?.({
                    pitches: event.playedPitches,
                    ordinal: event.ordinal,
                    index: runIndicesRef.current[event.ordinal] ?? 0,
                    timestamp,
                    timeMs: event.step.elapsedMs / dialRatio(),
                    // The written length to hold, taken from the cleared step itself,
                    // so it stays right regardless of where the visual cursor sits.
                    holdMs: event.step.holdMs / dialRatio(),
                    slackMs: event.step.slackMs / dialRatio(),
                    pedalled: event.step.pedalled,
                    ...askedFor(event, dialRatio()),
                    velocity,
                    velocities: event.velocities,
                    wrongBefore: event.wrongBefore,
                    staves: event.step.staves,
                    staffTimes: staffArrivals(event),
                });
                // Mirror the reducer's advance onto the visual cursor — unless the step
                // just cleared was an ornament, which is printed on the very note it
                // decorates, so the cursor has not left that note yet.
                if (event.step.advancesCursor) {
                    advanceCursor(osmd, runHandRef.current);
                }
                setDone((value) => value + 1);
                // A new position clears the per-position miss flag, so the "reveal
                // on mistake" hint hides again until the next slip.
                setMissedHere(false);
                // And if the position after this one is printed EARLIER than it, a repeat
                // barline has sent the run back. Announced rather than acted on here, for
                // the same reason the lap is: the halos belong to the surface.
                const following = runStepsRef.current[event.ordinal + 1];
                if (following !== undefined && jumpsBack(event.step, following)) {
                    optionsRef.current.onRewind?.();
                }
            }
            if (next.complete && runLoopRef.current) {
                // Lap the section: rewind the reducer and the cursor to the range's
                // first position and keep going. The run stays open — a drill has no
                // completion to grade — and the per-lap progress count starts over.
                const fresh = startMatch(runStepsRef.current);
                stateRef.current = fresh;
                seekToOrdinal(osmd.cursor, runStepsRef.current[0]!.position);
                setDone(0);
                setMissedHere(false);
                // Wipe the lap that has just ended, so the bars ahead read as unplayed
                // again. Announced rather than done here: the halos belong to the surface.
                optionsRef.current.onLap?.();
                publish(fresh);
                return;
            }
            publish(next);
            if (next.complete) {
                osmd.cursor.hide();
                practicingRef.current = false;
                setComplete(true);
                setPracticing(false);
            }
        },
        [getOsmd, dialRatio, publish],
    );

    return {
        practicing,
        expected,
        upcoming,
        previewAnchor,
        done,
        total,
        wrong,
        missedHere,
        lastWrong,
        range,
        complete,
        bar,
        start,
        stop,
        registerNote,
        preview,
        resetPreview,
    };
}
