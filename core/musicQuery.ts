// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { EMPTY_MUSIC_FILTER, type MusicFilter, type MusicKind } from "./music";
import { MAX_GRADE } from "./scoreDifficulty";

// The shelf's filters, read from and written to the page's own address.
//
// Where the filters live decides whether the shelf remembers: state held in the component
// is gone the moment a piece opens, so coming back from a piece means typing the search
// again and re-picking the grade. The address survives that trip, and it can be sent to
// somebody or kept as a bookmark — "every grade 2 study I have not tried" is a link.
//
// `grade` takes a list because the shelf's chips are multi-select, and a single value is
// the same thing with one entry: the roadmap's `?grade=6` keeps meaning what it always
// meant.

const KINDS: readonly MusicKind[] = ["song", "scale-arpeggio", "study"];

function grades(raw: string | undefined): ReadonlySet<number> {
    const found = (raw ?? "")
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((grade) => Number.isInteger(grade) && grade >= 1 && grade <= MAX_GRADE);
    return new Set(found);
}

export function readMusicFilter(params: Readonly<Record<string, string>>): MusicFilter {
    const kind = params.kind ?? "";
    return {
        query: params.q ?? "",
        kind: (KINDS as readonly string[]).includes(kind) ? (kind as MusicKind) : "",
        grades: grades(params.grade),
        favoritesOnly: params.starred === "1",
        dueOnly: params.due === "1",
        freshOnly: params.fresh === "1",
    };
}

// Only what differs from the plain shelf, so an unfiltered library keeps a clean address
// and every filter that is on can be read off the link.
export function musicFilterParams(filter: MusicFilter): Record<string, string> {
    const params: Record<string, string> = {};
    if (filter.query !== EMPTY_MUSIC_FILTER.query) {
        params.q = filter.query;
    }
    if (filter.kind !== EMPTY_MUSIC_FILTER.kind) {
        params.kind = filter.kind;
    }
    if (filter.grades.size > 0) {
        params.grade = [...filter.grades].sort((a, b) => a - b).join(",");
    }
    if (filter.favoritesOnly) {
        params.starred = "1";
    }
    if (filter.dueOnly) {
        params.due = "1";
    }
    if (filter.freshOnly) {
        params.fresh = "1";
    }
    return params;
}
