// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
export function useLibraryFilters(
    items: readonly LibraryItem[],
    mastery: Record<string, Mastery>,
    // A grade to open on, from the link that arrived here — the roadmap sends a reader to
    // "everything at grade 6" so that pressing a grade proves it is theirs to open. It
    // seeds the filter and nothing more: the All chip is right there.
    startGrade?: number,
) {
    const favorites = useFavorites();
    const [query, setQuery] = useState("");
    const [kind, setKind] = useState<LibraryKind | "">("");
    const [grades, setGrades] = useState<ReadonlySet<number>>(() =>
        startGrade === undefined ? new Set() : new Set([startGrade]),
    );
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [dueOnly, setDueOnly] = useState(false);
    const [freshOnly, setFreshOnly] = useState(false);
    const [visible, setVisible] = useState(PER_PAGE);

    // A new filter starts from the top of its (possibly long) result set.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when the filter changes
    useEffect(() => setVisible(PER_PAGE), [query, kind, grades, favoritesOnly, dueOnly, freshOnly]);

    const matches = useMemo(
        () =>
            filterLibrary(
                items,
                { query, kind, grades, favoritesOnly, dueOnly, freshOnly },
                { favorites, mastery, now: Date.now() },
            ),
        [items, query, kind, grades, favoritesOnly, dueOnly, freshOnly, favorites, mastery],
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
        freshOnly,
        toggleFreshOnly: () => setFreshOnly((on) => !on),
        toggleFavoritesOnly: () => setFavoritesOnly((on) => !on),
        dueOnly,
        toggleDueOnly: () => setDueOnly((on) => !on),
        favorites,
        matches,
        visible,
        showMore: () => setVisible((count) => count + PER_PAGE),
    };
}
