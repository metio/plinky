// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { DynamicsSummary } from "./dynamics";
import type { RhythmSummary } from "./rhythm";

// A performance grade for one run: each dimension is 0..100, combined into an
// overall score and a letter. Dynamics is null when the input carries no real
// velocity (the computer keyboard sends a fixed value), so it grades on accuracy
// and timing alone rather than rewarding a constant.
export type Letter = "S" | "A" | "B" | "C" | "D";

export type Grade = {
    accuracy: number;
    timing: number;
    dynamics: number | null;
    score: number;
    letter: Letter;
};

// Contrast-safe text colours per letter (light / dark), large display sizes.
export const GRADE_COLOR: Record<Letter, string> = {
    S: "text-amber-600 dark:text-amber-400",
    A: "text-green-600 dark:text-green-400",
    B: "text-indigo-600 dark:text-indigo-400",
    C: "text-orange-600 dark:text-orange-400",
    D: "text-red-600 dark:text-red-400",
};

export function letterFor(score: number): Letter {
    if (score >= 95) {
        return "S";
    }
    if (score >= 85) {
        return "A";
    }
    if (score >= 70) {
        return "B";
    }
    if (score >= 50) {
        return "C";
    }
    return "D";
}

export type GradeInput = {
    correct: number;
    wrong: number;
    rhythm: RhythmSummary;
    dynamics: DynamicsSummary | null;
};

export function computeGrade({ correct, wrong, rhythm, dynamics }: GradeInput): Grade {
    const attempts = correct + wrong;
    const accuracy = attempts > 0 ? (correct / attempts) * 100 : 0;

    // A perfectly-timed note counts full, a "good" one partially, an "off" one
    // not at all.
    const graded = rhythm.perfect + rhythm.good + rhythm.off;
    const timing = graded > 0 ? ((rhythm.perfect + rhythm.good * 0.6) / graded) * 100 : 100;

    const dynamicsScore = dynamics ? dynamics.evenness : null;
    const parts = dynamicsScore === null ? [accuracy, timing] : [accuracy, timing, dynamicsScore];
    const score = Math.round(parts.reduce((sum, part) => sum + part, 0) / parts.length);

    return {
        accuracy: Math.round(accuracy),
        timing: Math.round(timing),
        dynamics: dynamicsScore === null ? null : Math.round(dynamicsScore),
        score,
        letter: letterFor(score),
    };
}
