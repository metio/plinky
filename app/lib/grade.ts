// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { DynamicsSummary } from "./dynamics";
import type { RhythmSummary } from "./rhythm";

// A performance grade for one run: each dimension is 0..100, combined into an
// overall score and a letter. Accuracy, timing and flow are the core trio that
// the letter is computed from; dynamics is a MIDI-only bonus shown for feedback
// but kept out of the aggregate, so a keyboard run and a MIDI run of the same
// playing earn the same letter (the share card depends on that comparability).
// Dynamics is null when the input carries no real velocity (the computer keyboard
// sends a fixed value) rather than rewarding a constant.
export type Letter = "S" | "A" | "B" | "C" | "D" | "E" | "F";

export type Grade = {
    accuracy: number;
    timing: number;
    flow: number;
    dynamics: number | null;
    score: number;
    letter: Letter;
};

// A gold "S" tier above an A–F gradient that runs green → red. Contrast-safe
// text colours (light / dark) at the large size the grade letter is shown.
export const GRADE_COLOR: Record<Letter, string> = {
    S: "text-amber-500 dark:text-amber-300",
    A: "text-green-600 dark:text-green-400",
    B: "text-lime-600 dark:text-lime-400",
    C: "text-yellow-600 dark:text-yellow-400",
    D: "text-orange-600 dark:text-orange-400",
    E: "text-red-600 dark:text-red-400",
    F: "text-red-800 dark:text-red-500",
};

export function letterFor(score: number): Letter {
    if (score >= 95) {
        return "S";
    }
    if (score >= 85) {
        return "A";
    }
    if (score >= 75) {
        return "B";
    }
    if (score >= 65) {
        return "C";
    }
    if (score >= 55) {
        return "D";
    }
    if (score >= 40) {
        return "E";
    }
    return "F";
}

export type GradeInput = {
    correct: number;
    wrong: number;
    rhythm: RhythmSummary;
    flow: number; // 0..100, continuity (see lib/flow)
    dynamics: DynamicsSummary | null;
};

export function computeGrade({ correct, wrong, rhythm, flow, dynamics }: GradeInput): Grade {
    const attempts = correct + wrong;
    const accuracy = attempts > 0 ? (correct / attempts) * 100 : 0;

    // A perfectly-timed note counts full, a "good" one partially, an "off" one
    // not at all.
    const graded = rhythm.perfect + rhythm.good + rhythm.off;
    const timing = graded > 0 ? ((rhythm.perfect + rhythm.good * 0.6) / graded) * 100 : 100;

    // The letter comes from the core trio only; dynamics rides along for feedback.
    const score = Math.round((accuracy + timing + flow) / 3);

    return {
        accuracy: Math.round(accuracy),
        timing: Math.round(timing),
        flow: Math.round(flow),
        dynamics: dynamics ? Math.round(dynamics.evenness) : null,
        score,
        letter: letterFor(score),
    };
}
