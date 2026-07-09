// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Assignment, makeAssignment } from "./assignment";

// A built-in assignment is assembled from the shipped catalogue at load time, so it
// tracks the content-fingerprint ids instead of hardcoding them: the bundled demo
// tunes first (familiar, playable on day one), then the easiest grade-1 studies.
// Name and description arrive as parameters — this module carries no UI strings.
export function starterAssignment(input: {
    id: string;
    name: string;
    description: string;
    demos: { id: string }[];
    exercises: { id: string; grade: number; cost: number; kind: string }[];
}): Assignment | null {
    const studies = input.exercises
        .filter((exercise) => exercise.kind === "study" && exercise.grade === 1)
        .sort((a, b) => a.cost - b.cost)
        .slice(0, 3);
    const items = [...input.demos, ...studies].map((piece) => ({ id: piece.id }));
    if (items.length === 0) {
        return null;
    }
    return makeAssignment({
        id: input.id,
        name: input.name,
        description: input.description,
        items,
    });
}
