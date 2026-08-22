// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { DynamicsSummary } from "./dynamics";
import type { ExpressionSummary } from "./expressionGrade";
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
    // How closely the run followed the written dynamics and articulations, 0..100, or
    // null when the score marks no expression or the input cannot report it. Kept out
    // of the aggregate for the same reason `dynamics` is: an unmarked piece and a
    // computer keyboard must earn the same letter as a marked one on a real piano, or
    // the share card stops comparing like with like.
    expression: number | null;
    score: number;
    letter: Letter;
};

// Which readings a graded run has, in the order they are shown, and which of them this
// particular run earned.
//
// One list, because the readings appear in two places — the panel at the end of a run and
// the list of saved takes — and they had drifted: the takes list showed accuracy, timing and
// flow, and silently dropped the dynamics and expression the very same take had stored.
// Nothing could have caught that, because each place named its own rows by hand and both
// were internally consistent.
//
// The ids are what a reading IS; what it is called belongs to the layer that has the
// player's language. Adding a reading to Grade means adding it here, once, and both places
// gain it.
export type ScoreReading = "accuracy" | "timing" | "flow" | "dynamics" | "expression";

// The three that every run earns come first, then the two a run only earns when the score
// asks for them — an unmarked piece and a computer keyboard cannot be graded on dynamics
// or expression, and a null there means "not asked", never "scored zero".
const READINGS: { id: ScoreReading; of: (grade: Grade) => number | null }[] = [
    { id: "accuracy", of: (grade) => grade.accuracy },
    { id: "timing", of: (grade) => grade.timing },
    { id: "flow", of: (grade) => grade.flow },
    { id: "dynamics", of: (grade) => grade.dynamics },
    { id: "expression", of: (grade) => grade.expression },
];

export function scoreReadings(grade: Grade): { id: ScoreReading; value: number }[] {
    const out: { id: ScoreReading; value: number }[] = [];
    for (const { id, of } of READINGS) {
        const value = of(grade);
        if (value !== null) {
            out.push({ id, value });
        }
    }
    return out;
}

// Whether a reading is one every run earns, or one the score has to ask for. The two are
// shown differently — the optional pair sit quieter, because their absence is ordinary and
// says nothing about the playing.
export function isOptionalReading(id: ScoreReading): boolean {
    return id === "dynamics" || id === "expression";
}

// A gold "S" tier above an A–F gradient that runs green → red. Contrast-safe
// text colours (light / dark) at the large size the grade letter is shown.
export const GRADE_COLOR: Record<Letter, string> = {
    S: "text-grade-s",
    A: "text-grade-a",
    B: "text-grade-b",
    C: "text-grade-c",
    D: "text-grade-d",
    E: "text-grade-e",
    F: "text-grade-f",
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
        !(grade.dynamics === null || finite(grade.dynamics)) ||
        // A grade stored before expression was scored carries no such field. It reads
        // as "not measured", which is exactly what it was — rejecting the whole grade
        // would throw away every take saved until now.
        !(grade.expression === undefined || grade.expression === null || finite(grade.expression))
    ) {
        return null;
    }
    return {
        accuracy: grade.accuracy,
        timing: grade.timing,
        flow: grade.flow,
        dynamics: grade.dynamics,
        expression: finite(grade.expression) ? grade.expression : null,
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
    expression: ExpressionSummary | null;
};

export function computeGrade({
    correct,
    wrong,
    rhythm,
    flow,
    dynamics,
    expression,
}: GradeInput): Grade {
    const attempts = correct + wrong;
    // Nothing played is an F across the board, not a middling score from the
    // empty-input defaults of the individual dimensions disagreeing.
    if (attempts === 0) {
        return {
            accuracy: 0,
            timing: 0,
            flow: 0,
            dynamics: dynamics ? Math.round(dynamics.evenness) : null,
            expression: expression ? expression.score : null,
            score: 0,
            letter: "F",
        };
    }
    // A shown 100 means a hundred, not a rounded one. Plain rounding turns 249 right notes
    // out of 250 into "100%", and the flawless milestone reads those shown figures — so a
    // run with a wrong note in it was congratulated for having none. Everything short of
    // perfect stops at 99, which costs a fraction of a percent of precision and buys the
    // number back its meaning.
    const show = (value: number) => (value >= 100 ? 100 : Math.min(99, Math.round(value)));

    const accuracy = (correct / attempts) * 100;

    // A perfectly-timed note counts full, a "good" one partially, an "off" one
    // not at all.
    const graded = rhythm.perfect + rhythm.good + rhythm.off;
    const timing = graded > 0 ? ((rhythm.perfect + rhythm.good * 0.6) / graded) * 100 : 100;

    // The letter comes from the core trio only; dynamics and expression ride along
    // for feedback.
    const score = Math.round((accuracy + timing + flow) / 3);

    return {
        accuracy: show(accuracy),
        timing: show(timing),
        flow: show(flow),
        dynamics: dynamics ? Math.round(dynamics.evenness) : null,
        expression: expression ? expression.score : null,
        score,
        letter: letterFor(score),
    };
}
