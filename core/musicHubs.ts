// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The shelves the catalogue can be browsed by, beyond one composer at a time.
//
// Somebody looking for something to play asks for a level or a sound — "grade 3 piano
// pieces", "romantic piano music" — and the catalogue can answer both from what it
// already knows: every piece carries a grade, and every composer the catalogue could
// place carries a birth year. A hub is that answer as a page of its own, so the shelf has
// an address to link to and to be found at, rather than living only inside a filter.
//
// Pure: the pages and the edge both build their lists from here, and neither decides on
// its own which pieces belong on which shelf.

import type { PeopleAbout } from "./personAbout";
import { personSlugs } from "./person";

// The grades a piece can be, and so the grades that have a shelf. A grade with nothing in
// it is still a real address — the catalogue moves, and a page saying a shelf is empty
// today is honest, where a 404 would say the shelf never existed.
export const HUB_GRADES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type HubGrade = (typeof HUB_GRADES)[number];

// The eras, by the year the composer was born rather than the year a piece was written:
// a birth year is what Wikidata reliably holds for these four hundred people, and a
// catalogue of harvested scores rarely records a date of composition at all. That makes
// the boundaries a working approximation and not a musicological claim — somebody born in
// 1795 wrote Romantic music, and lands under Classical here.
//
// The bounds are the conventional ones, read as "born before": Bach and Handel (1685)
// Baroque, Haydn and Mozart Classical, Chopin and Liszt Romantic, everybody after
// Rachmaninoff and Debussy modern.
export const ERAS = ["baroque", "classical", "romantic", "modern"] as const;

export type Era = (typeof ERAS)[number];

const ERA_UNTIL: Record<Era, number> = {
    baroque: 1710,
    classical: 1800,
    romantic: 1870,
    modern: Number.POSITIVE_INFINITY,
};

// Which era somebody born in this year belongs to. Nothing for a composer the catalogue
// could not place: a page of pieces by people whose dates are unknown is not an era.
export function eraOf(born: number | undefined): Era | null {
    if (born === undefined || !Number.isFinite(born)) {
        return null;
    }
    return ERAS.find((era) => born < ERA_UNTIL[era]) ?? null;
}

// The grade a path segment names, or nothing. A hub's address is a real page or a real
// 404 — "/music/grade/9" and "/music/grade/03" are neither, and answering them with grade
// 3's pieces would put the same shelf at several addresses.
export function hubGrade(value: string): HubGrade | null {
    const found = HUB_GRADES.find((grade) => String(grade) === value);
    return found ?? null;
}

// Likewise for an era's slug.
export function hubEra(value: string): Era | null {
    return ERAS.find((era) => era === value) ?? null;
}

// Every composer's era, keyed by slug, from the file a page already fetches to say who
// its composer was. Composers with no birth year are absent rather than grouped together.
export function erasOf(people: PeopleAbout): Record<string, Era> {
    const eras: Record<string, Era> = {};
    for (const [slug, about] of Object.entries(people)) {
        const era = eraOf(about.born);
        if (era) {
            eras[slug] = era;
        }
    }
    return eras;
}

// Every era a piece belongs to: the era of each person credited on it. A credit naming
// two — an arrangement, a setting of somebody else's tune — puts the piece on both
// shelves, which is the honest answer and also the only one two readers can agree on.
// The edge writes these pages from the catalogue's composer-to-pieces index and the page
// itself from the manifest's credits; "any composer of this era" is the same set read
// from either end, where "the first composer" is not.
export function erasOfPiece(composer: string, eras: Record<string, Era>): Era[] {
    const found: Era[] = [];
    for (const slug of personSlugs(composer)) {
        const era = Object.hasOwn(eras, slug) ? (eras[slug] as Era) : null;
        if (era && !found.includes(era)) {
            found.push(era);
        }
    }
    return found;
}

export type HubPiece = { id: string; title: string; composer: string; grade?: number };

// One shelf's pieces, each piece once, easiest first and then by title — so the page opens
// on what a visitor at that level can actually start with. Ties broken by title rather
// than left to the order the manifest happens to be in, which is a hash order and looks
// like noise.
//
// Deduplicated by id, because a piece can be in two of the catalogue's manifests at once:
// the id is a fingerprint of the notes, so the same music harvested twice is one piece
// under one id, and a shelf that lists it twice is a shelf a reader distrusts. The edge
// writes these pages from a catalogue already keyed by id, so this is also what makes the
// two lists agree.
export function sortPieces<T extends HubPiece>(pieces: T[]): T[] {
    const once = new Map<string, T>();
    for (const piece of pieces) {
        if (!once.has(piece.id)) {
            once.set(piece.id, piece);
        }
    }
    return [...once.values()].sort(
        (a, b) => (a.grade ?? 0) - (b.grade ?? 0) || a.title.localeCompare(b.title),
    );
}

export function piecesOfGrade<T extends HubPiece>(pieces: T[], grade: HubGrade): T[] {
    return sortPieces(pieces.filter((piece) => piece.grade === grade));
}

export function piecesOfEra<T extends HubPiece>(
    pieces: T[],
    era: Era,
    eras: Record<string, Era>,
): T[] {
    return sortPieces(pieces.filter((piece) => erasOfPiece(piece.composer, eras).includes(era)));
}
