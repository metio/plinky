// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import { initialMatchState, type MatchState, matchNote } from "../lib/matching";
import type { Step } from "../lib/steps";

const EXPECTED_COLOR = "#4f46e5"; // indigo-600 — the step to play next
const DONE_COLOR = "#16a34a"; // green-600 — already played correctly
const WRONG_FLASH_MS = 600;

// Each step carries the SVG nodes that draw it; recoloring them in place moves
// the highlight without re-rendering the score.
function paintStep(step: Step, color: string | null): void {
    for (const element of step.elements) {
        element.style.fill = color ?? "";
    }
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
    // The pitches of the next step — one for a single note, several for a chord.
    nextPitches: number[];
    registerNote: (note: number, timestamp: number) => void;
    reset: () => void;
};

export function useNoteMatcher(steps: Step[], options: NoteMatcherOptions = {}): NoteMatcher {
    const { active = true } = options;
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const [state, setState] = useState<MatchState>(initialMatchState);
    // The first note of a chord anchors its timing; the chord scores from there.
    const onsetRef = useRef(0);
    const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // A fresh set of steps restarts the run. The effect body reads no steps, but
    // the dependency drives the reset whenever the phrase changes.
    // biome-ignore lint/correctness/useExhaustiveDependencies: steps is the reset trigger, not a read
    useEffect(() => {
        setState(initialMatchState);
    }, [steps]);

    // Past steps green, the current target indigo, everything ahead default ink.
    useEffect(() => {
        steps.forEach((step, index) => {
            paintStep(
                step,
                index < state.cursor ? DONE_COLOR : index === state.cursor ? EXPECTED_COLOR : null,
            );
        });
    }, [steps, state.cursor]);

    const registerNote = useCallback(
        (note: number, timestamp: number) => {
            if (!active) {
                return;
            }
            const wasIdle = state.pressed.length === 0;
            const { state: nextState, event } = matchNote(state, steps, note);
            if (wasIdle && (event.kind === "progress" || event.kind === "correct")) {
                onsetRef.current = timestamp;
            }
            setState(nextState);

            if (event.kind === "wrong") {
                optionsRef.current.onWrong?.(note, timestamp);
                if (wrongTimer.current) {
                    clearTimeout(wrongTimer.current);
                }
                wrongTimer.current = setTimeout(
                    () => setState((prev) => ({ ...prev, wrongNote: null })),
                    WRONG_FLASH_MS,
                );
            } else if (event.kind === "correct") {
                optionsRef.current.onCorrect?.(event.index, onsetRef.current);
                if (event.complete) {
                    optionsRef.current.onComplete?.(onsetRef.current);
                }
            }
        },
        [steps, state, active],
    );

    const reset = useCallback(() => setState(initialMatchState), []);

    useEffect(() => {
        return () => {
            if (wrongTimer.current) {
                clearTimeout(wrongTimer.current);
            }
        };
    }, []);

    const done = steps.length > 0 && state.cursor >= steps.length;
    const nextPitches = done ? [] : (steps[state.cursor]?.pitches ?? []);

    return {
        cursor: state.cursor,
        done,
        wrongNote: state.wrongNote,
        nextPitches,
        registerNote,
        reset,
    };
}
