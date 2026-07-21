// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useRef, useState } from "react";
import { readScoreExpression } from "../lib/scoreExpression";
import {
    currentBar,
    expectedPitches,
    type Hand,
    type MatcherState,
    type MatchStep,
    matchNote,
    isPracticedHand,
    startMatch,
    stepRange,
    type UpcomingStep,
    upcomingSteps,
} from "../../core/matcher";

// How many positions ahead the notes-highway look-ahead surfaces — enough to fill the
// tall highway panel that stands in for the score.
const HIGHWAY_LOOKAHEAD = 8;

export type { Hand } from "../../core/matcher";

// The MIDI pitches at the cursor's position (chords give several; rests and tied
// continuations give none), narrowed to the chosen hand, with the staves they sit
// on, the notated onset, and the longest written length here in quarter notes —
// one entry of the step model the pure matcher runs on. Collecting the hold length
// with the position means the run reads it off the step model, never the live
// cursor, so the cursor stays purely a visual mirror during a run.
function stepAtCursor(osmd: OpenSheetMusicDisplay, hand: Hand): Omit<MatchStep, "bar"> {
    const pitches: number[] = [];
    const staves = new Set<number>();
    let holdQuarters = 0;
    for (const note of osmd.cursor.NotesUnderCursor()) {
        if (note.isRest() || note.halfTone <= 0) {
            continue;
        }
        const staff = note.ParentStaff?.idInMusicSheet;
        if (!isPracticedHand(staff, hand)) {
            continue;
        }
        pitches.push(note.halfTone + 12);
        if (staff !== undefined) {
            staves.add(staff);
        }
        holdQuarters = Math.max(holdQuarters, readScoreExpression(note).notatedQuarters);
    }
    return {
        pitches,
        staves: [...staves].sort((a, b) => a - b),
        whole: osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0,
        holdQuarters,
    };
}

// Walk the engraved score once and lift it into the pure step model: every
// playable position for the chosen hand, in play order. Leaves the cursor reset.
// Exported so the duet can lift the sitting-out hand's positions the same way,
// reading the identical staff split the run itself matches on.
export function collectMatchSteps(osmd: OpenSheetMusicDisplay, hand: Hand): MatchStep[] {
    osmd.cursor.reset();
    const steps: MatchStep[] = [];
    while (!osmd.cursor.iterator.EndReached) {
        const step = stepAtCursor(osmd, hand);
        if (step.pitches.length > 0) {
            steps.push({ ...step, bar: osmd.cursor.iterator.CurrentMeasureIndex });
        }
        osmd.cursor.next();
    }
    osmd.cursor.reset();
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
    while (
        !osmd.cursor.iterator.EndReached &&
        ((osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0) < from ||
            stepAtCursor(osmd, hand).pitches.length === 0)
    ) {
        osmd.cursor.next();
    }
}

// Step the visual cursor to the next playable position for the hand — rests, and
// the stretches where only the other hand sounds, are skipped exactly the way the
// step collector skipped them.
function advanceCursor(osmd: OpenSheetMusicDisplay, hand: Hand): void {
    osmd.cursor.next();
    while (!osmd.cursor.iterator.EndReached && stepAtCursor(osmd, hand).pitches.length === 0) {
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
    velocity: number;
    // How many wrong notes were played at this position before it was cleared —
    // zero means a clean first try, the signal Flow and per-segment accuracy are
    // built from.
    wrongBefore: number;
    // The staves this position sits on (0 = treble/right, 1 = bass/left), so a run can be
    // scored per hand. Both when a chord spans the grand staff.
    staves: number[];
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
                optionsRef.current.forgiving ?? false,
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
                    timeMs: event.step.whole * 4 * (60000 / runTempoRef.current),
                    // The written length to hold, taken from the cleared step itself,
                    // so it stays right regardless of where the visual cursor sits.
                    holdMs: event.step.holdQuarters * (60000 / runTempoRef.current),
                    velocity,
                    wrongBefore: event.wrongBefore,
                    staves: event.step.staves,
                });
                // Mirror the reducer's advance onto the visual cursor.
                advanceCursor(osmd, runHandRef.current);
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
        [getOsmd],
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
