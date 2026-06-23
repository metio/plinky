// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import { type HandsState, initialHandsState, matchHands } from "../lib/handMatching";
import type { Hand } from "../lib/hands";

const EXPECTED_COLOR = "#4f46e5"; // indigo-600 — a step to play next
const DONE_COLOR = "#16a34a"; // green-600 — already played correctly
const WRONG_FLASH_MS = 600;

// Reported when a step (one note, or a hand's chord) completes. `ordinal` is the
// running count across all hands, so timed modes can treat the run as one stream
// while matching stays per hand.
export type CorrectInfo = {
    hand: number;
    pitches: number[];
    elements: HTMLElement[];
    timeMs: number;
    timestamp: number;
    ordinal: number;
    // Velocity of the note that completed the step (0..127); the on-screen and
    // computer keyboards send a fixed value, a MIDI piano the real one.
    velocity: number;
};

export type HandsMatcherOptions = {
    active?: boolean;
    onCorrect?: (info: CorrectInfo) => void;
    onWrong?: (note: number, timestamp: number) => void;
    onComplete?: (timestamp: number) => void;
};

export type NextHand = { label: string; pitches: number[] };

export type HandsMatcher = {
    done: boolean;
    wrongNote: number | null;
    nextByHand: NextHand[];
    handCount: number;
    completedSteps: number;
    totalSteps: number;
    registerNote: (note: number, timestamp: number, velocity?: number) => void;
    reset: () => void;
};

function paint(hands: Hand[], state: HandsState): void {
    hands.forEach((hand, handIndex) => {
        // `state` is reset to match `hands` in an effect, so for one render after
        // the hands change it can be shorter; treat a missing hand as fresh.
        const cursor = state.hands[handIndex]?.cursor ?? 0;
        hand.steps.forEach((step, index) => {
            const color = index < cursor ? DONE_COLOR : index === cursor ? EXPECTED_COLOR : null;
            for (const element of step.elements) {
                element.style.fill = color ?? "";
            }
        });
    });
}

export function useHandsMatcher(hands: Hand[], options: HandsMatcherOptions = {}): HandsMatcher {
    const { active = true } = options;
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const [state, setState] = useState<HandsState>(() => initialHandsState(hands.length));
    // First-note onset per hand, and a running count of completed steps.
    const onsetRef = useRef<number[]>([]);
    const ordinalRef = useRef(0);
    const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // A fresh set of hands restarts the run; the dependency drives the reset.
    // biome-ignore lint/correctness/useExhaustiveDependencies: hands is the reset trigger
    useEffect(() => {
        setState(initialHandsState(hands.length));
        onsetRef.current = [];
        ordinalRef.current = 0;
    }, [hands]);

    useEffect(() => {
        paint(hands, state);
    }, [hands, state]);

    const registerNote = useCallback(
        (note: number, timestamp: number, velocity = 80) => {
            if (!active) {
                return;
            }
            const wasIdle = state.hands.map((hand) => hand.pressed.length === 0);
            const { state: next, event } = matchHands(state, hands, note);
            setState(next);

            if (event.kind === "wrong") {
                optionsRef.current.onWrong?.(note, timestamp);
                if (wrongTimer.current) {
                    clearTimeout(wrongTimer.current);
                }
                wrongTimer.current = setTimeout(
                    () => setState((prev) => ({ ...prev, wrongNote: null })),
                    WRONG_FLASH_MS,
                );
                return;
            }
            if (event.kind === "progress" || event.kind === "correct") {
                if (wasIdle[event.hand]) {
                    onsetRef.current[event.hand] = timestamp;
                }
            }
            if (event.kind === "correct") {
                const step = hands[event.hand].steps[event.index];
                optionsRef.current.onCorrect?.({
                    hand: event.hand,
                    pitches: step.pitches,
                    elements: step.elements,
                    timeMs: step.timeMs,
                    timestamp: onsetRef.current[event.hand],
                    ordinal: ordinalRef.current++,
                    velocity,
                });
                if (event.complete) {
                    optionsRef.current.onComplete?.(onsetRef.current[event.hand]);
                }
            }
        },
        [hands, state, active],
    );

    const reset = useCallback(() => {
        setState(initialHandsState(hands.length));
        onsetRef.current = [];
        ordinalRef.current = 0;
    }, [hands.length]);

    useEffect(() => {
        return () => {
            if (wrongTimer.current) {
                clearTimeout(wrongTimer.current);
            }
        };
    }, []);

    const completedSteps = state.hands.reduce((sum, hand) => sum + hand.cursor, 0);
    const total = hands.reduce((sum, hand) => sum + hand.steps.length, 0);
    const done = total > 0 && completedSteps >= total;
    const nextByHand = hands.map((hand, handIndex) => ({
        label: hand.label,
        // See paint: `state` can briefly lag `hands`, so default a missing hand's
        // cursor to the start rather than dereferencing undefined.
        pitches: done ? [] : (hand.steps[state.hands[handIndex]?.cursor ?? 0]?.pitches ?? []),
    }));

    return {
        done,
        wrongNote: state.wrongNote,
        nextByHand,
        handCount: hands.length,
        completedSteps,
        totalSteps: total,
        registerNote,
        reset,
    };
}

// "C E G" for one hand, "RH: C · LH: G" when both hands play.
export function describeNext(nextByHand: NextHand[], noteName: (note: number) => string): string {
    const playing = nextByHand.filter((hand) => hand.pitches.length > 0);
    if (playing.length === 0) {
        return "";
    }
    if (playing.length === 1) {
        return playing[0].pitches.map(noteName).join(" ");
    }
    return playing
        .map((hand) => `${hand.label}: ${hand.pitches.map(noteName).join(" ")}`)
        .join(" · ");
}
