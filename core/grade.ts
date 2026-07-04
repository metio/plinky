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

const LETTERS: readonly Letter[] = ["S", "A", "B", "C", "D", "E", "F"];

function isLetter(value: unknown): value is Letter {
    return typeof value === "string" && (LETTERS as readonly string[]).includes(value);
}

// Validates an untrusted value (parsed from storage) as a Grade, returning null for
// anything of the wrong shape. Every dimension must be a finite number; dynamics is the
// one nullable field, kept null when a run carried no real velocity.
export function parseGrade(value: unknown): Grade | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const grade = value as Record<string, unknown>;
    const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
    if (
        !finite(grade.accuracy) ||
        !finite(grade.timing) ||
        !finite(grade.flow) ||
        !finite(grade.score) ||
        !isLetter(grade.letter) ||
        !(grade.dynamics === null || finite(grade.dynamics))
    ) {
        return null;
    }
    return {
        accuracy: grade.accuracy,
        timing: grade.timing,
        flow: grade.flow,
        dynamics: grade.dynamics,
        score: grade.score,
        letter: grade.letter,
    };
}

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

// The result of a tempo-enforced play-along run: how many notes were played in time (the
// clock waits for no one, so a note not cleared before it passes is a miss) out of the
// total, graded on that ratio against the same A–F ladder as a self-paced run.
export type KeepUpResult = { inTime: number; total: number; letter: Letter };

export function scoreKeepUp(hits: readonly boolean[]): KeepUpResult {
    const inTime = hits.filter(Boolean).length;
    const total = hits.length;
    const percent = total > 0 ? (100 * inTime) / total : 0;
    return { inTime, total, letter: letterFor(percent) };
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
    // Nothing played is an F across the board, not a middling score from the
    // empty-input defaults of the individual dimensions disagreeing.
    if (attempts === 0) {
        return {
            accuracy: 0,
            timing: 0,
            flow: 0,
            dynamics: dynamics ? Math.round(dynamics.evenness) : null,
            score: 0,
            letter: "F",
        };
    }
    const accuracy = (correct / attempts) * 100;

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
