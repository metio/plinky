// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useRef, useState } from "react";

// Which hand's staff to match: both together, or one alone for hands-separate
// practice. On the grand staff our scores build, the treble (right) is staff 0
// and the bass (left) is staff 1.
export type Hand = "both" | "right" | "left";
const STAFF_FOR: Record<Exclude<Hand, "both">, number> = { right: 0, left: 1 };

// The MIDI pitches that sound at the cursor's current position (chords give
// several; rests and tied continuations give none), narrowed to the chosen hand.
function pitchesAtCursor(osmd: OpenSheetMusicDisplay, hand: Hand = "both"): number[] {
    return osmd.cursor
        .NotesUnderCursor()
        .filter((note) => !note.isRest() && note.halfTone > 0)
        .filter((note) => hand === "both" || note.ParentStaff?.idInMusicSheet === STAFF_FOR[hand])
        .map((note) => note.halfTone + 12);
}

// The staves the notes at the cursor's current position sit on (treble/right = 0,
// bass/left = 1), narrowed to the chosen hand — so a cleared position can be attributed
// to a hand. A position that sounds on both staves reports both.
function stavesAtCursor(osmd: OpenSheetMusicDisplay, hand: Hand = "both"): number[] {
    const staves = new Set<number>();
    for (const note of osmd.cursor.NotesUnderCursor()) {
        if (note.isRest() || note.halfTone <= 0) {
            continue;
        }
        const staff = note.ParentStaff?.idInMusicSheet;
        if (staff === undefined || (hand !== "both" && staff !== STAFF_FOR[hand])) {
            continue;
        }
        staves.add(staff);
    }
    return [...staves].sort((a, b) => a - b);
}

// Skip positions with nothing to play for the chosen hand — rests, and the
// stretches where only the other hand sounds during hands-separate practice.
function advancePastRests(osmd: OpenSheetMusicDisplay, hand: Hand = "both"): void {
    while (!osmd.cursor.iterator.EndReached && pitchesAtCursor(osmd, hand).length === 0) {
        osmd.cursor.next();
    }
}

// The pitches of every playable position for the chosen hand, in play order —
// the same sequence the matcher steps through, so a fingering computed from it
// lines up with the run's progress. Leaves the cursor reset for the caller.
export function collectSteps(osmd: OpenSheetMusicDisplay, hand: Hand = "both"): number[][] {
    osmd.cursor.reset();
    const steps: number[][] = [];
    while (!osmd.cursor.iterator.EndReached) {
        const pitches = pitchesAtCursor(osmd, hand);
        if (pitches.length > 0) {
            steps.push(pitches);
        }
        osmd.cursor.next();
    }
    osmd.cursor.reset();
    return steps;
}

// Drives note-by-note practice of an OSMD score: the cursor marks the position to
// play, and once every pitch under it has been played the cursor advances. Wrong
// notes are ignored so a learner can hunt for the right key. The whole score's
// pitch range is exposed so the on-screen keyboard can frame it.
// What a correctly-played position reports: the pitches sounded, its index in the
// run, the wall-clock time it was played, and its notated onset in ms at `tempo`
// — enough for free practice (ignore timing) or rhythm grading (compare them).
export type CorrectInfo = {
    pitches: number[];
    ordinal: number;
    timestamp: number;
    timeMs: number;
    velocity: number;
    // How many wrong notes were played at this position before it was cleared —
    // zero means a clean first try, the signal Flow and per-segment accuracy are
    // built from.
    wrongBefore: number;
    // The staves this position sits on (0 = treble/right, 1 = bass/left), so a run can be
    // scored per hand. Both when a chord spans the grand staff.
    staves: number[];
};

export function useScoreMatcher(
    getOsmd: () => OpenSheetMusicDisplay | null,
    options: {
        onCorrect?: (info: CorrectInfo) => void;
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
    // The 0-based bar the cursor sits in, so a focus view can show the current bars
    // without re-deriving the position from the run count (which a hands-separate run
    // would skew). Read straight from the cursor the matcher already walks.
    const [bar, setBar] = useState(0);
    const hit = useRef<Set<number>>(new Set());
    const ordinalRef = useRef(0);
    const wrongSeq = useRef(0);
    const sinceWrong = useRef(0);
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
    const runForgivingRef = useRef(options.forgiving ?? false);
    // The full step sequence and the current index into it, so forgiving mode can ask
    // "does this note belong to the NEXT position?" without disturbing the cursor.
    const stepsRef = useRef<number[][]>([]);
    const stepRef = useRef(0);

    const stop = useCallback(() => {
        practicingRef.current = false;
        getOsmd()?.cursor?.hide();
        setPracticing(false);
    }, [getOsmd]);

    const start = useCallback(() => {
        const osmd = getOsmd();
        if (!osmd) {
            return;
        }
        const hand = optionsRef.current.hand ?? "both";
        // Count playable positions and the overall pitch range in one pass.
        osmd.cursor.reset();
        let count = 0;
        let lo = Number.POSITIVE_INFINITY;
        let hi = Number.NEGATIVE_INFINITY;
        while (!osmd.cursor.iterator.EndReached) {
            const pitches = pitchesAtCursor(osmd, hand);
            if (pitches.length > 0) {
                count++;
                lo = Math.min(lo, ...pitches);
                hi = Math.max(hi, ...pitches);
            }
            osmd.cursor.next();
        }
        // A score with no playable positions (all rests, or empty) has nothing to
        // match: entering the practicing state would strand the UI at 0/0 forever,
        // since completion is only reached by clearing a position.
        if (count === 0) {
            osmd.cursor.hide();
            return;
        }
        // The whole sequence, for forgiving look-ahead; collectSteps leaves the cursor
        // reset, so position it again below.
        stepsRef.current = collectSteps(osmd, hand);
        stepRef.current = 0;
        osmd.cursor.reset();
        advancePastRests(osmd, hand);
        osmd.cursor.show();
        setBar(osmd.cursor.iterator.CurrentMeasureIndex);
        hit.current.clear();
        ordinalRef.current = 0;
        sinceWrong.current = 0;
        runTempoRef.current = optionsRef.current.tempo ?? 100;
        runHandRef.current = hand;
        runForgivingRef.current = optionsRef.current.forgiving ?? false;
        practicingRef.current = true;
        setTotal(count);
        setDone(0);
        setWrong(0);
        setMissedHere(false);
        setComplete(false);
        setRange(Number.isFinite(lo) ? { from: lo - 2, to: hi + 2 } : null);
        setExpected(pitchesAtCursor(osmd, hand));
        setPracticing(true);
    }, [getOsmd]);

    const registerNote = useCallback(
        (note: number, timestamp = performance.now(), velocity = 0) => {
            const osmd = getOsmd();
            if (!practicingRef.current || !osmd || osmd.cursor.iterator.EndReached) {
                return;
            }
            // Clear the current position: record what was played, step the cursor and
            // index forward, and set up the next — returns false once the run is complete.
            const advance = (playedPitches: number[]): boolean => {
                const timeMs =
                    (osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0) *
                    4 *
                    (60000 / runTempoRef.current);
                optionsRef.current.onCorrect?.({
                    pitches: playedPitches,
                    ordinal: ordinalRef.current,
                    timestamp,
                    timeMs,
                    velocity,
                    wrongBefore: sinceWrong.current,
                    staves: stavesAtCursor(osmd, runHandRef.current),
                });
                ordinalRef.current += 1;
                sinceWrong.current = 0;
                hit.current.clear();
                osmd.cursor.next();
                advancePastRests(osmd, runHandRef.current);
                stepRef.current += 1;
                setBar(osmd.cursor.iterator.CurrentMeasureIndex);
                setDone((value) => value + 1);
                if (osmd.cursor.iterator.EndReached) {
                    osmd.cursor.hide();
                    practicingRef.current = false;
                    setComplete(true);
                    setExpected([]);
                    setPracticing(false);
                    return false;
                }
                // A new position clears the per-position miss flag, so the "reveal on
                // mistake" hint hides again until the next slip.
                setMissedHere(false);
                setExpected(pitchesAtCursor(osmd, runHandRef.current));
                return true;
            };

            const expectedNow = pitchesAtCursor(osmd, runHandRef.current);
            if (expectedNow.includes(note)) {
                hit.current.add(note);
                if (expectedNow.every((pitch) => hit.current.has(pitch))) {
                    advance(expectedNow);
                }
                return;
            }
            // The note isn't for this position. Forgiving mode: if it starts the NEXT
            // position the player has moved on — credit what they played here, advance,
            // and let this note count toward the new position, so one hand's slip never
            // freezes the other.
            if (runForgivingRef.current && stepsRef.current[stepRef.current + 1]?.includes(note)) {
                if (advance([...hit.current])) {
                    const nextExpected = pitchesAtCursor(osmd, runHandRef.current);
                    if (nextExpected.includes(note)) {
                        hit.current.add(note);
                        if (nextExpected.every((pitch) => hit.current.has(pitch))) {
                            advance(nextExpected);
                        }
                    }
                }
                return;
            }
            // A genuine wrong note.
            setWrong((value) => value + 1);
            sinceWrong.current += 1;
            setMissedHere(true);
            wrongSeq.current += 1;
            setLastWrong({ note, seq: wrongSeq.current });
        },
        [getOsmd],
    );

    return {
        practicing,
        expected,
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
