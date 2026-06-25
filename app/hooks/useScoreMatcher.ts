// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useRef, useState } from "react";

// The MIDI pitches that sound at the cursor's current position (chords give
// several; rests and tied continuations give none).
function pitchesAtCursor(osmd: OpenSheetMusicDisplay): number[] {
    return osmd.cursor
        .NotesUnderCursor()
        .filter((note) => !note.isRest() && note.halfTone > 0)
        .map((note) => note.halfTone + 12);
}

function advancePastRests(osmd: OpenSheetMusicDisplay): void {
    while (!osmd.cursor.iterator.EndReached && pitchesAtCursor(osmd).length === 0) {
        osmd.cursor.next();
    }
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
};

export function useScoreMatcher(
    getOsmd: () => OpenSheetMusicDisplay | null,
    options: { onCorrect?: (info: CorrectInfo) => void; tempo?: number } = {},
) {
    const [practicing, setPracticing] = useState(false);
    const [expected, setExpected] = useState<number[]>([]);
    const [done, setDone] = useState(0);
    const [total, setTotal] = useState(0);
    const [wrong, setWrong] = useState(0);
    const [range, setRange] = useState<{ from: number; to: number } | null>(null);
    const [complete, setComplete] = useState(false);
    const hit = useRef<Set<number>>(new Set());
    const ordinalRef = useRef(0);
    const sinceWrong = useRef(0);
    const practicingRef = useRef(false);
    const optionsRef = useRef(options);
    optionsRef.current = options;

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
        // Count playable positions and the overall pitch range in one pass.
        osmd.cursor.reset();
        let count = 0;
        let lo = Number.POSITIVE_INFINITY;
        let hi = Number.NEGATIVE_INFINITY;
        while (!osmd.cursor.iterator.EndReached) {
            const pitches = pitchesAtCursor(osmd);
            if (pitches.length > 0) {
                count++;
                lo = Math.min(lo, ...pitches);
                hi = Math.max(hi, ...pitches);
            }
            osmd.cursor.next();
        }
        osmd.cursor.reset();
        advancePastRests(osmd);
        osmd.cursor.show();
        hit.current.clear();
        ordinalRef.current = 0;
        sinceWrong.current = 0;
        practicingRef.current = true;
        setTotal(count);
        setDone(0);
        setWrong(0);
        setComplete(false);
        setRange(Number.isFinite(lo) ? { from: lo - 2, to: hi + 2 } : null);
        setExpected(pitchesAtCursor(osmd));
        setPracticing(true);
    }, [getOsmd]);

    const registerNote = useCallback(
        (note: number, timestamp = performance.now(), velocity = 0) => {
            const osmd = getOsmd();
            if (!practicingRef.current || !osmd || osmd.cursor.iterator.EndReached) {
                return;
            }
            const expectedNow = pitchesAtCursor(osmd);
            if (!expectedNow.includes(note)) {
                setWrong((value) => value + 1);
                sinceWrong.current += 1;
                return;
            }
            hit.current.add(note);
            if (!expectedNow.every((pitch) => hit.current.has(pitch))) {
                return;
            }
            const timeMs =
                (osmd.cursor.iterator.currentTimeStamp?.RealValue ?? 0) *
                4 *
                (60000 / (optionsRef.current.tempo ?? 100));
            optionsRef.current.onCorrect?.({
                pitches: expectedNow,
                ordinal: ordinalRef.current,
                timestamp,
                timeMs,
                velocity,
                wrongBefore: sinceWrong.current,
            });
            ordinalRef.current += 1;
            sinceWrong.current = 0;
            hit.current.clear();
            osmd.cursor.next();
            advancePastRests(osmd);
            setDone((value) => value + 1);
            if (osmd.cursor.iterator.EndReached) {
                osmd.cursor.hide();
                practicingRef.current = false;
                setComplete(true);
                setExpected([]);
                setPracticing(false);
                return;
            }
            setExpected(pitchesAtCursor(osmd));
        },
        [getOsmd],
    );

    return { practicing, expected, done, total, wrong, range, complete, start, stop, registerNote };
}
