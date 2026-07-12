// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { isDue, type Mastery } from "./mastery";

// A unified catalogue row, tagged by kind so the library can be filtered into
// songs, generated scales/arpeggios, and curated studies. Exercises and songs
// carry a precomputed grade from their manifest; local scores are graded from
// their inlined MusicXML. Only user imports are removable.
export type LibraryKind = "song" | "scale-arpeggio" | "study";

export type LibraryItem = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    removable: boolean;
    kind: LibraryKind;
};

// The five filter axes of the library list. An empty kind means every kind and
// an empty grade set means every grade; the grades are multi-select, so a
// player can line up e.g. grades 3 and 4 at once — each still means exactly
// that grade.
export type LibraryFilter = {
    query: string;
    kind: LibraryKind | "";
    grades: ReadonlySet<number>;
    favoritesOnly: boolean;
    dueOnly: boolean;
};

export const EMPTY_LIBRARY_FILTER: LibraryFilter = {
    query: "",
    kind: "",
    grades: new Set(),
    favoritesOnly: false,
    dueOnly: false,
};

// The per-player state the filters consult: the starred set, the mastery
// record per piece, and the clock for the due check.
export type LibraryContext = {
    favorites: ReadonlySet<string>;
    mastery: Record<string, Mastery>;
    now: number;
};

// An imported score can share a fingerprint id with a catalogue piece (import
// only warns, it still saves), so the combined list keeps the first occurrence
// of each id — a duplicate would collide as a React key and render twice.
export function filterLibrary(
    items: readonly LibraryItem[],
    filter: LibraryFilter,
    context: LibraryContext,
): LibraryItem[] {
    const needle = filter.query.trim().toLowerCase();
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item.id)) {
            return false;
        }
        seen.add(item.id);
        if (filter.kind && item.kind !== filter.kind) {
            return false;
        }
        if (filter.grades.size > 0 && !filter.grades.has(item.grade)) {
            return false;
        }
        if (filter.favoritesOnly && !context.favorites.has(item.id)) {
            return false;
        }
        if (filter.dueOnly) {
            const mastery = context.mastery[item.id];
            if (!mastery || !isDue(mastery, context.now)) {
                return false;
            }
        }
        if (!needle) {
            return true;
        }
        return (
            item.title.toLowerCase().includes(needle) ||
            item.composer.toLowerCase().includes(needle)
        );
    });
}

// One grade chip flips without touching its neighbours.
export function toggledGrade(grades: ReadonlySet<number>, grade: number): Set<number> {
    const next = new Set(grades);
    if (next.has(grade)) {
        next.delete(grade);
    } else {
        next.add(grade);
    }
    return next;
}

// How many pieces are due for review right now — the header banner and the
// visibility of the "Due now" chip both hang off this count.
export function dueCount(mastery: Record<string, Mastery>, now: number): number {
    return Object.values(mastery).filter((entry) => isDue(entry, now)).length;
}
