// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {useCallback, useEffect, useRef, useState} from "react";
import type {NoteTimingEvent} from "abcjs";

const EXPECTED_COLOR = "#4f46e5"; // indigo-600 — the note to play next
const DONE_COLOR = "#16a34a"; // green-600 — already played correctly
const WRONG_FLASH_MS = 600;

// Each timing event carries the SVG nodes that draw its note; recoloring them
// in place moves the highlight without re-rendering the score.
function paintEvent(event: NoteTimingEvent, color: string | null): void {
    for (const group of event.elements ?? []) {
        for (const element of group) {
            element.style.fill = color ?? "";
        }
    }
}

export function expectedPitches(event: NoteTimingEvent | undefined): number[] {
    return event?.midiPitches?.map((pitch) => pitch.pitch) ?? [];
}

export type NoteMatcherOptions = {
    // When false, played notes are ignored — used to hold a scored run until the
    // player has explicitly started it.
    active?: boolean;
    onCorrect?: (index: number, timestamp: number) => void;
    onWrong?: (note: number, timestamp: number) => void;
    onComplete?: (timestamp: number) => void;
};

export type NoteMatcher = {
    cursor: number;
    done: boolean;
    wrongNote: number | null;
    nextPitch: number | undefined;
    registerNote: (note: number, timestamp: number) => void;
    reset: () => void;
};

export function useNoteMatcher(events: NoteTimingEvent[], options: NoteMatcherOptions = {}): NoteMatcher {
    const {active = true} = options;
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const [cursor, setCursor] = useState(0);
    const [wrongNote, setWrongNote] = useState<number | null>(null);
    const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // A fresh tune restarts the run from the first note.
    useEffect(() => {
        setCursor(0);
        setWrongNote(null);
    }, [events]);

    // Past notes green, the current target indigo, everything ahead default ink.
    useEffect(() => {
        events.forEach((event, index) => {
            paintEvent(event, index < cursor ? DONE_COLOR : index === cursor ? EXPECTED_COLOR : null);
        });
    }, [events, cursor]);

    const registerNote = useCallback(
        (note: number, timestamp: number) => {
            if (!active) {
                return;
            }
            const expected = expectedPitches(events[cursor]);
            if (expected.length === 0) {
                return;
            }

            if (expected.includes(note)) {
                setWrongNote(null);
                optionsRef.current.onCorrect?.(cursor, timestamp);
                const next = cursor + 1;
                setCursor(next);
                if (next >= events.length) {
                    optionsRef.current.onComplete?.(timestamp);
                }
                return;
            }

            optionsRef.current.onWrong?.(note, timestamp);
            setWrongNote(note);
            if (wrongTimer.current) {
                clearTimeout(wrongTimer.current);
            }
            wrongTimer.current = setTimeout(() => setWrongNote(null), WRONG_FLASH_MS);
        },
        [events, cursor, active],
    );

    const reset = useCallback(() => {
        setWrongNote(null);
        setCursor(0);
    }, []);

    useEffect(() => {
        return () => {
            if (wrongTimer.current) {
                clearTimeout(wrongTimer.current);
            }
        };
    }, []);

    const done = events.length > 0 && cursor >= events.length;
    const nextPitch = done ? undefined : expectedPitches(events[cursor])[0];

    return {cursor, done, wrongNote, nextPitch, registerNote, reset};
}
