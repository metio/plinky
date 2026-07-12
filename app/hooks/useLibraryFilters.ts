// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useState } from "react";
import {
    filterLibrary,
    type LibraryItem,
    type LibraryKind,
    toggledGrade,
} from "../../core/library";
import type { Mastery } from "../../core/mastery";
import { useFavorites } from "./useFavorites";

const PER_PAGE = 60;

// The library list's filter state — search, kind, multi-select grades, and the
// starred/due toggles — plus paging, applied over the pure core filter. The
// starred set is subscribed, so starring anywhere (this list, seeding) refreshes
// the matches.
export function useLibraryFilters(items: readonly LibraryItem[], mastery: Record<string, Mastery>) {
    const favorites = useFavorites();
    const [query, setQuery] = useState("");
    const [kind, setKind] = useState<LibraryKind | "">("");
    const [grades, setGrades] = useState<ReadonlySet<number>>(new Set());
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [dueOnly, setDueOnly] = useState(false);
    const [visible, setVisible] = useState(PER_PAGE);

    // A new filter starts from the top of its (possibly long) result set.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when the filter changes
    useEffect(() => setVisible(PER_PAGE), [query, kind, grades, favoritesOnly, dueOnly]);

    const matches = useMemo(
        () =>
            filterLibrary(
                items,
                { query, kind, grades, favoritesOnly, dueOnly },
                { favorites, mastery, now: Date.now() },
            ),
        [items, query, kind, grades, favoritesOnly, dueOnly, favorites, mastery],
    );

    return {
        query,
        setQuery,
        kind,
        setKind,
        grades,
        toggleGrade: (grade: number) => setGrades((prev) => toggledGrade(prev, grade)),
        clearGrades: () => setGrades(new Set()),
        favoritesOnly,
        toggleFavoritesOnly: () => setFavoritesOnly((on) => !on),
        dueOnly,
        toggleDueOnly: () => setDueOnly((on) => !on),
        favorites,
        matches,
        visible,
        showMore: () => setVisible((count) => count + PER_PAGE),
    };
}
