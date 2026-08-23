// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MusicKind } from "./music";

// What the library's filter bar says about itself when it is closed.
//
// On a phone the three axes are folded behind one line, and that line has to answer the
// question somebody actually has — "why am I only seeing four pieces?" — without being
// opened. So it reads back the choices in the order they were offered rather than showing
// empty controls, and it counts them, because a count is what tells you there is something
// to clear even when the line has been cut short.
//
// The parts arrive already translated. Deciding WHICH parts appear is the same decision in
// every language; rendering them is not, and mixing the two is how a summary ends up with
// English word order baked into it.

export type MusicFilterState = {
    kind: MusicKind | "";
    grades: ReadonlySet<number>;
    favoritesOnly: boolean;
    freshOnly: boolean;
    dueOnly: boolean;
};

export type MusicFilterLabels = {
    kind: (kind: MusicKind) => string;
    // One grade or several — the two read differently in most languages, so the caller is
    // handed the whole list and picks the phrasing rather than being given a joiner.
    grades: (grades: readonly number[]) => string;
    favorites: string;
    fresh: string;
    due: string;
};

// A filter counts when it narrows the list. "All" is the absence of a choice, so a kind of
// "" and an empty grade set contribute nothing — otherwise the badge would read 2 on a
// library nobody has filtered.
export function activeFilterCount(state: MusicFilterState): number {
    return (
        (state.kind === "" ? 0 : 1) +
        state.grades.size +
        (state.favoritesOnly ? 1 : 0) +
        (state.freshOnly ? 1 : 0) +
        (state.dueOnly ? 1 : 0)
    );
}

// The grades in the order a reader expects to see them, which is not the order they were
// tapped in — a Set preserves insertion, and "Grades 7, 2" reads as a mistake.
export function sortedGrades(state: MusicFilterState): number[] {
    return [...state.grades].sort((a, b) => a - b);
}

// The pieces of the sentence, in the order the axes are offered. Empty when nothing is
// filtering, which is the caller's cue to say so in one word instead of joining nothing.
export function filterSummaryParts(state: MusicFilterState, labels: MusicFilterLabels): string[] {
    const parts: string[] = [];
    if (state.kind !== "") parts.push(labels.kind(state.kind));
    const grades = sortedGrades(state);
    if (grades.length > 0) parts.push(labels.grades(grades));
    if (state.favoritesOnly) parts.push(labels.favorites);
    if (state.freshOnly) parts.push(labels.fresh);
    if (state.dueOnly) parts.push(labels.due);
    return parts;
}
