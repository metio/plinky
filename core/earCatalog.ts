// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Ear training joins the same grade ladder as the pieces, so an ear round counts toward
// your standing and skill the way playing does. A piece earns its place by its fingering
// cost, measured from the notation; an ear exercise has no notation to measure, so its
// difficulty is a design fact stated here instead — how hard the ear finds the task, not
// how hard the hands find the keys.
//
// The grades and costs sit on the SAME scale the pieces use (see core/scoreDifficulty's
// GRADE_THRESHOLDS), so an ear item and a piece of the same grade are genuinely
// comparable and the skill rating can average across both.

import {
    CHORD_LEVELS,
    type EarExerciseId,
    INTERVAL_LEVELS,
    MELODIC_LEVELS,
    PROGRESSION_LEVELS,
    SCALE_DEGREE_LEVELS,
    SCALE_LEVELS,
} from "./earExercise";

// A bounded run of rounds. Grading needs a settled accuracy, and an endless stream never
// settles — ten rounds is long enough to mean something and short enough to fit the gap
// ear training is for.
export const EAR_SESSION_ROUNDS = 10;

export type EarItem = {
    id: string;
    exercise: EarExerciseId;
    // Which interval level, for the intervals exercise; null for an exercise that has no
    // levels. The id encodes it too, but callers match on the structured field.
    level: number | null;
    grade: number; // 1..8, the pool it joins
    cost: number; // difficulty within the grade, on the pieces' cost scale
};

// One item per interval level — the levels ARE a difficulty ladder, so each is its own
// gradeable challenge (mastering "everything" doesn't retroactively master "fifths and
// octaves"; they are practised and graded apart). Perfect pitch stands alone.
//
// The grades climb with the ear's difficulty: fifths and octaves are the first intervals
// a beginner tells apart; the seconds and sixths carry the colour that has to be learned;
// naming a bare note with no reference is the hardest of these and sits well up the
// ladder.
// One item per level, per exercise. The grades climb both across levels (harder sets) and
// across exercises: telling major from minor is roughly a chord's easiest ask, while the
// modes and the full seventh set sit well up the ladder. Chord and scale reading are a
// touch harder than the matching interval level, so they start a grade higher.
const LADDERS: { exercise: EarExerciseId; levels: unknown[]; grades: number[]; costs: number[] }[] =
    [
        { exercise: "intervals", levels: INTERVAL_LEVELS, grades: [1, 2, 3, 4], costs: [1.3, 2.0, 2.6, 3.2] },
        { exercise: "chords", levels: CHORD_LEVELS, grades: [2, 3, 4, 5], costs: [1.8, 2.4, 3.0, 3.6] },
        { exercise: "scales", levels: SCALE_LEVELS, grades: [2, 4, 5, 6], costs: [1.8, 3.0, 3.6, 4.2] },
        // Holding a whole progression in the ear and naming each chord is the hardest of
        // these, so it starts higher and climbs furthest.
        { exercise: "progressions", levels: PROGRESSION_LEVELS, grades: [3, 4, 5, 6], costs: [2.2, 2.8, 3.4, 4.0] },
        // The functional exercises — hearing notes against a key the cadence sets — are the
        // deep end: naming a degree, then an interval in context, then a whole melody.
        { exercise: "scale-degrees", levels: SCALE_DEGREE_LEVELS, grades: [3, 5, 7], costs: [2.4, 3.6, 5.0] },
        { exercise: "intervals-context", levels: INTERVAL_LEVELS, grades: [3, 4, 5, 6], costs: [2.4, 3.0, 3.6, 4.2] },
        { exercise: "melodic-dictation", levels: MELODIC_LEVELS, grades: [5, 6, 7], costs: [3.6, 4.4, 5.2] },
    ];

export const EAR_ITEMS: EarItem[] = [
    ...LADDERS.flatMap(({ exercise, levels, grades, costs }) =>
        levels.map((_level, index) => ({
            id: `ear-${exercise}-${index}`,
            exercise,
            level: index,
            grade: grades[index] ?? grades.at(-1) ?? 4,
            cost: costs[index] ?? costs.at(-1) ?? 3.2,
        })),
    ),
    { id: "ear-perfect-pitch", exercise: "perfect-pitch", level: null, grade: 5, cost: 3.6 },
];

// The gradeable item a session trains — the answer surface a player picked. A level-based
// exercise trains its level; perfect pitch (level null) is level-independent, so it
// matches whatever level is passed.
export function earItemFor(exercise: EarExerciseId, level: number): EarItem | undefined {
    return EAR_ITEMS.find(
        (item) => item.exercise === exercise && (item.level === null || item.level === level),
    );
}

// The item behind an id, so a due ear review can drive the right drill and the practice
// link can resolve its kind — the inverse of earItemFor.
export function earItemById(id: string): EarItem | undefined {
    return EAR_ITEMS.find((item) => item.id === id);
}
