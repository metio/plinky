// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Exercise } from "./exercises";

export type PathStatus = "done" | "current" | "locked";
export type PathStep = { exercise: Exercise; status: PathStatus };

// Walk the curriculum in order: finished exercises are "done", the first
// unfinished one is "current", and everything after it stays "locked" until you
// reach it. `isDone` decides completion (e.g. a recorded best score).
export function pathSteps(exercises: Exercise[], isDone: (id: string) => boolean): PathStep[] {
    let unlocked = true;
    return exercises.map((exercise) => {
        const done = isDone(exercise.id);
        const status: PathStatus = done ? "done" : unlocked ? "current" : "locked";
        if (!done) {
            unlocked = false;
        }
        return { exercise, status };
    });
}
