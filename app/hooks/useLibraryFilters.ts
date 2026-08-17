// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { useScheduler } from "../contexts/services";
import { useFavorites } from "./useFavorites";

const PER_PAGE = 60;

// How long the address waits behind the typing. Long enough that a word is one write
// rather than nine, short enough that a link copied straight after typing carries the
// search.
const ADDRESS_DELAY_MS = 400;

// Handed to the filter whenever the starred filter is off — a stable reference, so
// starring a piece does not count as a change to what is being filtered.
const NO_STARRED: ReadonlySet<string> = new Set();

// The library list's filter state — search, kind, multi-select grades, and the
// starred/due toggles — plus paging, applied over the pure core filter. The
// starred set is subscribed, so starring anywhere (this list, seeding) refreshes
// the matches.
//
// The filters live in the page's address rather than in this hook, so opening a piece and
// coming back finds the shelf as it was left; `core/libraryQuery` is the whole of the
// reading and writing. Every change replaces the current history entry instead of adding
// one, so Back leaves the library rather than walking a search back a letter at a time.
//
// The search text is the exception, and deliberately so. It used to be held in the address
// and read back out of it, which put a router navigation between pressing a key and seeing
// the letter: the field showed a value that arrived one navigation late, so fast typing
// dropped characters and felt blocked. The text is now local state — the field is never
// waiting on anything — and the address is brought up to date once the typing pauses. The
// list follows through useDeferredValue, so filtering three thousand pieces is work React
// may interrupt rather than work that must finish before the next keystroke can be drawn.
export function useLibraryFilters(items: readonly LibraryItem[], mastery: Record<string, Mastery>) {
    const favorites = useFavorites();
    const scheduler = useScheduler();
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

    // What is in the box right now, and the last value this hook put in the address. The
    // pair is what tells a change of address made HERE from one made anywhere else.
    const [typed, setTyped] = useState(query);
    const written = useRef(query);

    // The address changed for a reason that is not this field — Back, a shared link, a
    // chip that cleared the search — so the box adopts it.
    useEffect(() => {
        if (query !== written.current) {
            written.current = query;
            setTyped(query);
        }
    }, [query]);

    // …and once the typing pauses, the address catches up. Only the search parameter is
    // touched, so a grade toggled while a write was pending cannot be undone by it.
    useEffect(() => {
        if (typed === written.current) {
            return;
        }
        const handle = scheduler.after(ADDRESS_DELAY_MS, () => {
            written.current = typed;
            setSearchParams(
                (prev) => {
                    const next = Object.fromEntries(prev);
                    if (typed === "") {
                        delete next.q;
                    } else {
                        next.q = typed;
                    }
                    return next;
                },
                { replace: true, preventScrollReset: true },
            );
        });
        return () => scheduler.cancel(handle);
    }, [typed, scheduler, setSearchParams]);

    // The list reads the deferred text, so a keystroke is never behind a re-filter.
    const applied = useDeferredValue(typed);

    // A new filter starts from the top of its (possibly long) result set.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when the filter changes
    useEffect(
        () => setVisible(PER_PAGE),
        [applied, kind, grades, favoritesOnly, dueOnly, freshOnly],
    );

    // The filter the shelf is actually showing: everything from the address, with the
    // search text as typed rather than as last written to it.
    const showing = useMemo(() => ({ ...filter, query: applied }), [filter, applied]);

    // The filter reads the starred set only to answer the starred filter, so while that is
    // off it is handed a stable empty one. Otherwise every star tapped anywhere in the app
    // re-filtered three thousand pieces to produce the same list back.
    const starred = favoritesOnly ? favorites : NO_STARRED;
    const matches = useMemo(
        () => filterLibrary(items, showing, { favorites: starred, mastery, now: Date.now() }),
        [items, showing, starred, mastery],
    );

    return {
        // What the box shows: instant, and never a navigation behind.
        query: typed,
        // What the results are for. A consumer that filters reads this one, so its work
        // rides the same deferred pass the list does.
        applied,
        setQuery: setTyped,
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
