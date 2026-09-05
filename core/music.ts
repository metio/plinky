// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isDue, type Mastery } from "./mastery";
import type { Reach } from "./reach";

// A unified catalogue row, tagged by kind so the library can be filtered into
// songs, generated scales/arpeggios, and curated studies. Exercises and songs
// carry a precomputed grade from their manifest; local scores are graded from
// their inlined MusicXML. Only user imports are removable.
export type MusicKind = "song" | "scale-arpeggio" | "study";

export type MusicItem = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    // The playing effort the grade was binned from, so a grade's own pieces can be
    // ordered gentlest first. Both manifests carry it; a local import is measured the
    // same way. Absent means unmeasured, which sorts last within its grade.
    cost?: number;
    // The opening bars, encoded, where the catalogue carries them.
    incipit?: string;
    // What this piece grades at with its inner notes taken out, where the catalogue has
    // measured it (core/simplify). A hard piece whose tune is easy can say so in the list
    // rather than only reading as out of reach.
    reach?: Reach;
    removable: boolean;
    kind: MusicKind;
};

// The filter axes of the library list. An empty kind means every kind and an empty grade
// set means every grade; the grades are multi-select, so a player can line up e.g. grades
// 3 and 4 at once — each still means exactly that grade.
export type MusicFilter = {
    query: string;
    kind: MusicKind | "";
    grades: ReadonlySet<number>;
    favoritesOnly: boolean;
    dueOnly: boolean;
    // Pieces with no history at all: what is left to discover, once a shelf has been
    // played through for a while. "Something I have not tried" is a real way to browse
    // three thousand pieces, and the mastery record already knows the answer.
    freshOnly: boolean;
};

export const EMPTY_MUSIC_FILTER: MusicFilter = {
    query: "",
    kind: "",
    grades: new Set(),
    favoritesOnly: false,
    dueOnly: false,
    freshOnly: false,
};

// The per-player state the filters consult: the starred set, the mastery
// record per piece, and the clock for the due check.
export type MusicContext = {
    favorites: ReadonlySet<string>;
    mastery: Record<string, Mastery>;
    now: number;
};

// An imported score can share a fingerprint id with a catalogue piece (import
// only warns, it still saves), so the combined list keeps the first occurrence
// of each id — a duplicate would collide as a React key and render twice.
// What somebody types and what a title is spelled with are rarely the same string:
// "hanschen" is how a reader without an umlaut key looks for Hänschen Klein, and 473 of
// the catalogue's titles carry a mark of some kind. Folding both sides to their bare
// letters means the search finds the piece either way, and costs nothing to anybody who
// does type the accent.
export function foldForSearch(text: string): string {
    return (
        text
            .normalize("NFD")
            // Only a Latin letter gives up its marks. A kana's dakuten is not an accent —
            // it is what tells ハ from バ from パ — and folding those together would make
            // three different syllables match each other.
            .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
            .replace(/[\u2018\u2019\u02bc]/g, "'")
            // Put back together what was only taken apart to look at: a kana keeps its
            // mark, and a folded string is comparable to one that never decomposed.
            .normalize("NFC")
            .toLowerCase()
    );
}

// An item's title and composer folded for search, once per item: folding is a unicode
// normalisation and a regex over the string, and the shelf re-filters three thousand
// items on every keystroke. Keyed weakly, so a list that goes away takes its folds along.
const FOLDED = new WeakMap<MusicItem, { title: string; composer: string }>();
export function searchFields(item: MusicItem): { title: string; composer: string } {
    let fields = FOLDED.get(item);
    if (!fields) {
        fields = { title: foldForSearch(item.title), composer: foldForSearch(item.composer) };
        FOLDED.set(item, fields);
    }
    return fields;
}

export function filterMusic(
    items: readonly MusicItem[],
    filter: MusicFilter,
    context: MusicContext,
): MusicItem[] {
    const needle = foldForSearch(filter.query.trim());
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
        if (filter.freshOnly && context.mastery[item.id] !== undefined) {
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
        const folded = searchFields(item);
        return folded.title.includes(needle) || folded.composer.includes(needle);
    });
}

// The order a shelf is read in: by grade, then gentlest first inside a grade — which is
// what `cost` measures and what both manifests are already sorted by before they are
// concatenated here. Without it the two bundled demos come first, then every scale and
// study, and no piece of music appears until the third screen.
export function musicOrder(items: readonly MusicItem[]): MusicItem[] {
    return [...items].sort(
        (a, b) =>
            a.grade - b.grade ||
            (a.cost ?? Number.POSITIVE_INFINITY) - (b.cost ?? Number.POSITIVE_INFINITY) ||
            a.title.localeCompare(b.title),
    );
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
