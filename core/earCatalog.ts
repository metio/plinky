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

import { type EarExerciseId, INTERVAL_LEVELS } from "./earExercise";

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
const INTERVAL_GRADES = [1, 2, 3, 4];
const INTERVAL_COSTS = [1.3, 2.0, 2.6, 3.2];

export const EAR_ITEMS: EarItem[] = [
    ...INTERVAL_LEVELS.map((_level, index) => ({
        id: `ear-intervals-${index}`,
        exercise: "intervals" as EarExerciseId,
        level: index,
        grade: INTERVAL_GRADES[index] ?? INTERVAL_GRADES.at(-1) ?? 4,
        cost: INTERVAL_COSTS[index] ?? INTERVAL_COSTS.at(-1) ?? 3.2,
    })),
    { id: "ear-perfect-pitch", exercise: "perfect-pitch", level: null, grade: 5, cost: 3.6 },
];

// The gradeable item a session trains — the answer surface a player picked. An interval
// session trains its level; perfect pitch is level-independent.
export function earItemFor(exercise: EarExerciseId, level: number): EarItem | undefined {
    if (exercise === "intervals") {
        return EAR_ITEMS.find((item) => item.exercise === "intervals" && item.level === level);
    }
    return EAR_ITEMS.find((item) => item.exercise === exercise);
}

// Whether an id belongs to an ear item, for the seams that must tell an ear item from a
// piece — the review queue holds it out (an ear item has no score to render yet), and a
// future ear-review slice will let it back in.
export function isEarItem(id: string): boolean {
    return id.startsWith("ear-");
}
