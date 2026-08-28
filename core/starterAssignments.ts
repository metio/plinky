// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

// A named work the catalogue holds, as an assignment.
//
// These are not a new kind of thing for a player to learn: Plinky already has assignments,
// and a book of studies is exactly one — a named, ordered list of pieces to work through.
// The only difference from the set a teacher sends is where the list came from.
//
// Ids that no longer resolve are dropped rather than carried, since an assignment naming a
// piece the device cannot open reads as broken; a set left with nothing is not offered.
// The order is the catalogue's, gentlest first.
export function catalogueAssignment(input: {
    set: { id: string; name: string; items: string[] };
    known: (id: string) => boolean;
}): Assignment | null {
    const items = input.set.items.filter(input.known).map((id) => ({ id }));
    if (items.length === 0) {
        return null;
    }
    return makeAssignment({ id: input.set.id, name: input.set.name, items });
}
