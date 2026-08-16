// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
    filterLibrary,
    type LibraryFilter,
    type LibraryItem,
    type LibraryKind,
    toggledGrade,
} from "../../core/library";
import { libraryFilterParams, readLibraryFilter } from "../../core/libraryQuery";
import type { Mastery } from "../../core/mastery";
import { useFavorites } from "./useFavorites";

const PER_PAGE = 60;

// The library list's filter state — search, kind, multi-select grades, and the
// starred/due toggles — plus paging, applied over the pure core filter. The
// starred set is subscribed, so starring anywhere (this list, seeding) refreshes
// the matches.
//
// The filters live in the page's address rather than in this hook, so opening a piece and
// coming back finds the shelf as it was left; `core/libraryQuery` is the whole of the
// reading and writing. Every change replaces the current history entry instead of adding
// one, so Back leaves the library rather than walking a search back a letter at a time.
export function useLibraryFilters(items: readonly LibraryItem[], mastery: Record<string, Mastery>) {
    const favorites = useFavorites();
    const [searchParams, setSearchParams] = useSearchParams();
    const [visible, setVisible] = useState(PER_PAGE);

    const filter = useMemo(
        () => readLibraryFilter(Object.fromEntries(searchParams)),
        [searchParams],
    );

    const update = useCallback(
        (next: LibraryFilter) => {
            setSearchParams(
                (prev) => {
                    // Everything the shelf does not own — the tab, above all — stays put.
                    const kept = Object.fromEntries(prev);
                    for (const key of ["q", "kind", "grade", "starred", "due", "fresh"]) {
                        delete kept[key];
                    }
                    return { ...kept, ...libraryFilterParams(next) };
                },
                { replace: true, preventScrollReset: true },
            );
        },
        [setSearchParams],
    );

    const { query, kind, grades, favoritesOnly, dueOnly, freshOnly } = filter;

    // A new filter starts from the top of its (possibly long) result set.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when the filter changes
    useEffect(() => setVisible(PER_PAGE), [query, kind, grades, favoritesOnly, dueOnly, freshOnly]);

    const matches = useMemo(
        () => filterLibrary(items, filter, { favorites, mastery, now: Date.now() }),
        [items, filter, favorites, mastery],
    );

    return {
        query,
        setQuery: (next: string) => update({ ...filter, query: next }),
        kind,
        setKind: (next: LibraryKind | "") => update({ ...filter, kind: next }),
        grades,
        toggleGrade: (grade: number) => update({ ...filter, grades: toggledGrade(grades, grade) }),
        clearGrades: () => update({ ...filter, grades: new Set() }),
        favoritesOnly,
        freshOnly,
        toggleFreshOnly: () => update({ ...filter, freshOnly: !freshOnly }),
        toggleFavoritesOnly: () => update({ ...filter, favoritesOnly: !favoritesOnly }),
        dueOnly,
        toggleDueOnly: () => update({ ...filter, dueOnly: !dueOnly }),
        favorites,
        matches,
        visible,
        showMore: () => setVisible((count) => count + PER_PAGE),
    };
}
