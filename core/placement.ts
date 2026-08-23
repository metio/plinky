// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_DRILL, type DrillOptions } from "./drill";

// Where a reader actually is, found by reading rather than asked in a form.
//
// Every app in this category asks a newcomer to pick "beginner / intermediate /
// advanced" and takes them at their word, which is why so many land somewhere
// that bores or drowns them. This walks a ladder instead: read a drill, and the
// next one is harder or the run takes a strike. Three strikes ends it, and what
// comes out is one number.
//
// The drills are generated, never repertoire — a piece you might have played
// before measures memory, not reading.

// Rungs on the ladder. Three per grade, so the result has finer resolution than
// "grade 4" while still mapping onto the eight-grade ladder the rest of the app
// speaks.
export const STEPS_PER_GRADE = 3;
export const PLACEMENT_GRADES = 8;
export const TOP_LEVEL = PLACEMENT_GRADES * STEPS_PER_GRADE;

// The share of a drill that must be read cleanly to count as passed. Matches the
// threshold sight-reading assessments have settled on: high enough that a pass
// means the reading held, low enough that one fumble is not a verdict.
export const PASS_SCORE = 80;
// A run below the threshold. Three of them and the ladder has found its ceiling —
// enough that one bad drill cannot end the test, few enough that it stays short.
export const MAX_STRIKES = 3;

export type Placement = {
    // The rung being read now, 1..TOP_LEVEL.
    level: number;
    strikes: number;
    // The highest rung read cleanly, 0 when none has been.
    cleared: number;
    // Every score so far, newest last — the test's own record of how it went.
    scores: number[];
    done: boolean;
};

export function startPlacement(from = 1): Placement {
    return {
        level: clampLevel(from),
        strikes: 0,
        cleared: 0,
        scores: [],
        done: false,
    };
}

function clampLevel(level: number): number {
    if (!Number.isFinite(level)) {
        return 1;
    }
    return Math.min(TOP_LEVEL, Math.max(1, Math.round(level)));
}

// Fold a finished drill's score into the test. A pass climbs; a miss takes a
// strike and stays put, so the reader gets another drill at the rung that caught
// them rather than being dropped for one shaky run. Clearing the top rung ends the
// test — there is nothing harder to ask for.
export function advancePlacement(state: Placement, score: number): Placement {
    if (state.done) {
        return state;
    }
    const scores = [...state.scores, score];
    if (score >= PASS_SCORE) {
        const cleared = Math.max(state.cleared, state.level);
        const next = state.level + 1;
        return {
            ...state,
            scores,
            cleared,
            level: Math.min(TOP_LEVEL, next),
            done: next > TOP_LEVEL,
        };
    }
    const strikes = state.strikes + 1;
    return { ...state, scores, strikes, done: strikes >= MAX_STRIKES };
}

// The one number the test reports: a hundred per rung cleared, so it reads like a
// scale rather than a percentage and has room to grow between grades. Zero means
// the first rung was never cleared, which is a real answer — it says start at the
// beginning — rather than a failure to measure.
export function placementRating(state: Placement): number {
    return state.cleared * 100;
}

// The grade a rating belongs to: the ladder the rest of the app already speaks, so
// the result can point at a grade's pieces. A reader who cleared nothing starts at
// grade 1, the bottom, not at grade 0 — there is no such thing.
export function placementGrade(state: Placement): number {
    if (state.cleared === 0) {
        return 1;
    }
    return Math.min(PLACEMENT_GRADES, Math.ceil(state.cleared / STEPS_PER_GRADE));
}

// What each grade's drills are made of. The ladder widens on every axis a reader
// meets in order: first the span they must cover, then the key signatures, then
// two hands, then chords to read down, then rhythm that will not sit on the beat.
type GradeProfile = {
    fifths: number;
    low: number;
    high: number;
    hands: 1 | 2;
    notesPerColumn: number;
    rhythm: DrillOptions["rhythm"];
    maxLeap: number;
    smoothness: number;
};

const PROFILES: GradeProfile[] = [
    // A five-finger position, stepwise, one hand — the first week of reading.
    {
        fifths: 0,
        low: 72,
        high: 79,
        hands: 1,
        notesPerColumn: 1,
        rhythm: "quarters",
        maxLeap: 2,
        smoothness: 5,
    },
    // The octave opens up and the hand starts to move.
    {
        fifths: 0,
        low: 67,
        high: 81,
        hands: 1,
        notesPerColumn: 1,
        rhythm: "quarters",
        maxLeap: 4,
        smoothness: 4,
    },
    // One sharp, and the left hand joins.
    {
        fifths: 1,
        low: 55,
        high: 81,
        hands: 2,
        notesPerColumn: 1,
        rhythm: "quarters",
        maxLeap: 5,
        smoothness: 3,
    },
    // Flats, and the rhythm stops sitting on every beat.
    {
        fifths: -1,
        low: 52,
        high: 84,
        hands: 2,
        notesPerColumn: 1,
        rhythm: "varied",
        maxLeap: 7,
        smoothness: 2,
    },
    // Two accidentals in the signature, and notes to read down as well as along.
    {
        fifths: 2,
        low: 48,
        high: 84,
        hands: 2,
        notesPerColumn: 2,
        rhythm: "varied",
        maxLeap: 9,
        smoothness: 1,
    },
    // Three flats, wider still, and eighths that keep coming.
    {
        fifths: -3,
        low: 45,
        high: 88,
        hands: 2,
        notesPerColumn: 2,
        rhythm: "eighths",
        maxLeap: 12,
        smoothness: 1,
    },
    // Four sharps, three-note chords, and the leap limit lifted.
    {
        fifths: 4,
        low: 41,
        high: 91,
        hands: 2,
        notesPerColumn: 3,
        rhythm: "varied",
        maxLeap: 0,
        smoothness: 0,
    },
    // Every note in the octave, most of the keyboard, nothing held back.
    {
        fifths: -5,
        low: 36,
        high: 96,
        hands: 2,
        notesPerColumn: 3,
        rhythm: "eighths",
        maxLeap: 0,
        smoothness: 0,
    },
];

// The drill a rung asks for. Within a grade the three steps lengthen the drill
// rather than change its shape: the same reading, sustained longer, which is what
// separates "can read a bar of this" from "can read this".
export function levelDrill(level: number, title?: string): DrillOptions {
    const rung = clampLevel(level);
    const grade = Math.ceil(rung / STEPS_PER_GRADE);
    const step = ((rung - 1) % STEPS_PER_GRADE) + 1;
    const profile = PROFILES[grade - 1] ?? PROFILES[0];
    if (!profile) {
        return DEFAULT_DRILL;
    }
    return {
        ...DEFAULT_DRILL,
        ...profile,
        // Chromatic only at the very top, where reading every note in the octave
        // is the thing being tested rather than an obstacle in the way of it.
        chromatic: grade === PLACEMENT_GRADES,
        bars: 2 + step * 2,
        beatsPerBar: 4,
        ...(title ? { title } : {}),
    };
}

// How far through the test the reader is, 0..1 — for a progress bar that cannot
// promise an exact number of drills, since a strike does not advance the ladder.
export function placementProgress(state: Placement): number {
    if (state.done) {
        return 1;
    }
    const byLevel = (state.level - 1) / TOP_LEVEL;
    const byStrikes = state.strikes / MAX_STRIKES;
    return Math.min(1, Math.max(byLevel, byStrikes));
}
