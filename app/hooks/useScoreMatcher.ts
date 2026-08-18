// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
import { type DynamicPoint, volumeAt } from "../../core/dynamics";

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
import type { ScoreParts } from "../../core/parts";
import {
    isGraceNote,
    playOrder,
    readDynamics,
    readPedalSpans,
    readParts,
    readScoreExpression,
    readStartTempo,
    readTempo,
} from "../lib/scoreExpression";
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
    startMatch,
    stepRange,
    type UpcomingStep,
    upcomingSteps,
} from "../../core/matcher";

// How many positions ahead the notes-highway look-ahead surfaces. The panel spans a
// fixed stretch of music, so what fills it is a question about the music rather than a
// count: this is generous enough that a run of semiquavers still reaches the top, and
// the ones that fall off it are dropped without being drawn.
const HIGHWAY_LOOKAHEAD = 32;

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
        shortest = Math.min(shortest, note.Length.RealValue * 4);
    }
    return Number.isFinite(shortest) ? shortest : 1;
}

// One group of a position: what is struck together there. An ordinary position has a
// single group; a position carrying an ornament has one per grace entry and then the
// notes that fall on the beat.
type StepGroup = Omit<
    MatchStep,
    "bar" | "elapsedMs" | "holdMs" | "expected" | "advancesCursor" | "slackMs" | "pedalled"
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
    dynamics: readonly DynamicPoint[],
): PositionSteps {
    // The dynamic in force at this position, read once: it is a property of where the
    // cursor sits, not of any one note under it.
    const dynamicVolume = volumeAt(dynamics, osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0);
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
            pitchStaves.push(staff ?? 0);
            pitchHands.push(handOfStaff(staff, parts));
            // Each key is asked for on its own terms: its own accent over the standing
            // dynamic, and its own sounding length narrowed by its own articulation. The
            // sounding length, not the written one — a tied minim is held for the tie.
            expected.push({
                velocity:
                    dynamicVolume === null ? null : velocityOf({ ...expression, dynamicVolume }),
                soundQuarters: expression.soundQuarters * lengthScaleOf(expression),
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
            whole: osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0,
            holdQuarters,
            expected,
            graceQuarters,
        });
    }

    return {
        whole: osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0,
        // The SHORTEST written length here, rests included — the gap to the next onset,
        // the same measure playback advances the cursor by. Only the repeat arithmetic
        // reads it, and only where the printed onsets jump.
        advanceQuarters: shortestLength(osmd),
        // The tempo in force, so a piece that changes speed is measured by the clock it
        // is written against rather than one average for the whole score.
        bpm: readTempo(osmd.cursor.iterator) ?? NOMINAL_BPM,
        stretch: fermata ? FERMATA_STRETCH : 1,
        groups,
    };
}

// What the score asked of each pitch the player actually struck, index-aligned with the
// event's `playedPitches` rather than with the step's own order — the two differ, because
// a chord is cleared in whatever order the hands find it.
//
// A pitch with no expectation of its own (nothing matched it in the step, which forgiving
// mode can produce) reports none, and the expressive reading skips it rather than scoring
// it against a neighbour's mark.
function askedFor(
    event: { step: MatchStep; playedPitches: number[] },
    ratio: number,
): {
    expectedVelocities: (number | null)[];
    expectedHoldsMs: number[];
    writtenHoldsMs: number[];
} {
    const expectedVelocities: (number | null)[] = [];
    const expectedHoldsMs: number[] = [];
    const writtenHoldsMs: number[] = [];
    for (const pitch of event.playedPitches) {
        const asked = event.step.expected?.[event.step.pitches.indexOf(pitch)];
        expectedVelocities.push(asked?.velocity ?? null);
        expectedHoldsMs.push(asked ? asked.holdMs / ratio : 0);
        writtenHoldsMs.push(asked ? asked.writtenHoldMs / ratio : 0);
    }
    return { expectedVelocities, expectedHoldsMs, writtenHoldsMs };
}

// When each hand got to this position: the EARLIEST arrival among the pitches that
// staff owns, because a hand's moment is when it struck rather than when it finished a
// rolled chord.
function staffArrivals(event: {
    step: MatchStep;
    playedPitches: number[];
    arrivals: number[];
}): Record<number, number> {
    const times: Record<number, number> = {};
    for (const [index, pitch] of event.playedPitches.entries()) {
        const at = event.arrivals[index];
        if (at === undefined) {
            continue;
        }
        const note = event.step.pitches.indexOf(pitch);
        const staff = event.step.pitchStaves[note] ?? 0;
        times[staff] = Math.min(times[staff] ?? at, at);
    }
    return times;
}

// Walk the engraved score once and lift it into the pure step model: every
// playable position for the chosen hand, in play order. Leaves the cursor reset.
// Exported so the duet can lift the sitting-out hand's positions the same way,
// reading the identical staff split the run itself matches on.
export function collectMatchSteps(osmd: OpenSheetMusicDisplay, hand: Hand): MatchStep[] {
    // Which staves are the practised instrument's, worked out from the sheet rather than
    // assumed: on an art song the piano is staves 1 and 2, and staff 0 is the singer.
    const parts = readParts(osmd);
    // Every dynamic the score writes, read once for the walk: a mark stands until the
    // next one, so it is a property of where a position sits rather than of the position.
    const dynamics = readDynamics(osmd);
    // Where the score asks for the sustain pedal, so a passage meant to be pedalled is
    // not read as one played staccato.
    const pedals = readPedalSpans(osmd);
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
            ...stepsAtCursor(osmd, hand, parts, dynamics),
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
                elapsedMs: onset,
                holdMs: quartersMs(group.holdQuarters * stretch, bpm),
                // An ornament may be crushed in before the beat or leaned on, taking half
                // the value of the note it decorates. The step model places it before the
                // beat; the window is widened to reach the other reading, so a player who
                // leans is not marked late. On the ornament that is the distance it was
                // placed ahead of the beat; on the note it decorates, the half of its own
                // length an appoggiatura would take.
                pedalled: pedalledAt(pedals, position.whole),
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

// Walk the reset cursor forward to the first playable position at or after `from`,
// so the visual cursor and the reducer agree from note one.
function seekCursorTo(osmd: OpenSheetMusicDisplay, hand: Hand, from: number): void {
    const parts = readParts(osmd);
    while (
        !osmd.cursor.iterator.EndReached &&
        ((osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0) < from ||
            // Only whether the position is playable is asked here, so it needs no
            // dynamics: seeking is about finding a note, not about how it sounds.
            playableAtCursor(osmd, hand, parts) === 0)
    ) {
        osmd.cursor.next();
    }
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
        // A wrong note at a position: its whole-piece step index and how many wrong
        // attempts that position has absorbed so far (1 on the first slip) — what a
        // tries budget compares against.
        onWrong?: (info: { index: number; misses: number }) => void;
        tempo?: number;
        hand?: Hand;
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
    const optionsRef = useRef(options);
    optionsRef.current = options;
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
    const runStartIndexRef = useRef(0);

    const stop = useCallback(() => {
        practicingRef.current = false;
        getOsmd()?.cursor?.hide();
        setPracticing(false);
    }, [getOsmd]);

    // Begin a run. `fromWhole` — a notated onset in whole notes from the top of the
    // piece — starts partway through, at the first playable position at or after it,
    // so taking over from Listen (or resuming a paused run) continues from the shared
    // cursor position rather than rewinding. The run is graded for what it covers:
    // total and progress count only the positions from here on. The default, 0, starts
    // at note one.
    const start = useCallback(
        // `loop` — a 1-based inclusive bar range — overrides the resume point: the run
        // plays only that section and laps it until stopped.
        (fromWhole = 0, loop: { from: number; to: number } | null = null) => {
            const osmd = getOsmd();
            if (!osmd) {
                return;
            }
            const hand = optionsRef.current.hand ?? "both";
            const all = collectMatchSteps(osmd, hand);
            // The first position at or after the resume point; -1 when none remains
            // (the cursor sits past the last note), which leaves nothing to play.
            const startIndex =
                fromWhole > 0 ? all.findIndex((step) => step.whole >= fromWhole - 1e-6) : 0;
            const steps = loop
                ? all.filter((step) => step.bar >= loop.from - 1 && step.bar <= loop.to - 1)
                : startIndex < 0
                  ? []
                  : all.slice(startIndex);
            // A score with no playable positions (all rests, empty, or resumed past the
            // end) has nothing to match: entering the practicing state would strand the
            // UI at 0/0 forever, since completion is only reached by clearing a position.
            if (steps.length === 0) {
                osmd.cursor.hide();
                return;
            }
            const state = startMatch(steps);
            stateRef.current = state;
            // The collector leaves the cursor reset; walk it to the run's first position.
            seekCursorTo(osmd, hand, steps[0]!.whole);
            osmd.cursor.show();
            runLoopRef.current = loop !== null;
            runStepsRef.current = steps;
            // Both slicing and the loop's bar filter keep contiguous runs of `all`,
            // so the first step's position anchors every later relative index.
            runStartIndexRef.current = steps[0] ? all.indexOf(steps[0]) : 0;
            runTempoRef.current = optionsRef.current.tempo ?? 100;
            runStartBpmRef.current = readStartTempo(osmd) ?? NOMINAL_BPM;
            runHandRef.current = hand;
            practicingRef.current = true;
            setBar(currentBar(state));
            setTotal(steps.length);
            setDone(0);
            setWrong(0);
            setMissedHere(false);
            setComplete(false);
            setRange(stepRange(steps));
            setExpected(expectedPitches(state));
            setUpcoming(upcomingSteps(state, HIGHWAY_LOOKAHEAD));
            setPracticing(true);
        },
        [getOsmd],
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
                        index: runStartIndexRef.current + next.index,
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
                    index: runStartIndexRef.current + event.ordinal,
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
            }
            if (next.complete && runLoopRef.current) {
                // Lap the section: rewind the reducer and the cursor to the range's
                // first position and keep going. The run stays open — a drill has no
                // completion to grade — and the per-lap progress count starts over.
                const fresh = startMatch(runStepsRef.current);
                stateRef.current = fresh;
                osmd.cursor.reset();
                seekCursorTo(osmd, runHandRef.current, runStepsRef.current[0]!.whole);
                setDone(0);
                setMissedHere(false);
                setBar(currentBar(fresh));
                setExpected(expectedPitches(fresh));
                setUpcoming(upcomingSteps(fresh, HIGHWAY_LOOKAHEAD));
                return;
            }
            setBar(currentBar(next));
            setExpected(expectedPitches(next));
            setUpcoming(upcomingSteps(next, HIGHWAY_LOOKAHEAD));
            if (next.complete) {
                osmd.cursor.hide();
                practicingRef.current = false;
                setComplete(true);
                setPracticing(false);
            }
        },
        [getOsmd, dialRatio],
    );

    return {
        practicing,
        expected,
        upcoming,
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
    };
}
