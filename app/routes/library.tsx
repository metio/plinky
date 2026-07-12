// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useRef } from "react";
import { Show } from "../components/features/conditional";
import { LibraryFilters } from "../components/features/libraryFilters";
import { LibraryRow } from "../components/features/libraryRow";
import { ScoreBackup } from "../components/features/scoreBackup";
import { Button } from "../components/ui/button";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { dueCount } from "../../core/library";
import { isDue } from "../../core/mastery";
import { routeMeta } from "../../core/site";
import { useFavoritesStore } from "../contexts/services";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { useLibraryItems } from "../hooks/useLibraryItems";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/library";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.library_heading(), m.meta_library_description());
}

export default function LibraryRoute() {
    const favoritesStore = useFavoritesStore();
    const { items, mastery, loaded, remove, assignmentsUsing } = useLibraryItems();
    const filters = useLibraryFilters(items, mastery);
    const searchRef = useRef<HTMLInputElement>(null);

    // The confirm label for a removable score names how many saved assignments
    // still reference it — the delete proceeds either way, and those steps then
    // read as missing on the assignments page.
    const removeConfirmLabel = (id: string) => {
        const used = assignmentsUsing(id);
        if (used === 0) {
            return m.action_remove_confirm();
        }
        return used === 1
            ? m.library_remove_used_one({ count: used })
            : m.library_remove_used_other({ count: used });
    };

    const now = Date.now();
    const due = dueCount(mastery, now);
    const { matches, visible } = filters;

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.library_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.library_intro()}</p>
                <Show when={due > 0}>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {m.mastery_due_count({ count: due })}
                    </p>
                </Show>
            </header>

            {/* The catalogue runs to thousands of songs, so the "it isn't here, add
                your own" path sits up top where someone who just failed a search can
                find it, not buried under a long, paginated list. */}
            <Link
                to="/library/import"
                className="flex items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50/60 px-4 py-2.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200"
            >
                <span>{m.library_cant_find()}</span>
                <span aria-hidden="true">→</span>
            </Link>

            <input
                ref={searchRef}
                type="search"
                value={filters.query}
                onChange={(event) => filters.setQuery(event.target.value)}
                placeholder={m.scores_search_placeholder()}
                aria-label={m.scores_search_placeholder()}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />

            <LibraryFilters
                kind={filters.kind}
                onKind={filters.setKind}
                grades={filters.grades}
                onToggleGrade={filters.toggleGrade}
                onClearGrades={filters.clearGrades}
                favoritesOnly={filters.favoritesOnly}
                onToggleFavoritesOnly={filters.toggleFavoritesOnly}
                dueOnly={filters.dueOnly}
                onToggleDueOnly={filters.toggleDueOnly}
                showDue={due > 0}
            />

            <p className="text-xs text-gray-500 dark:text-gray-400">
                {matches.length === 1
                    ? m.scores_count_one({ count: matches.length })
                    : m.scores_count_other({ count: matches.length })}
            </p>

            {!loaded ? (
                <div className="h-64" aria-hidden="true" />
            ) : (
                <>
                    {matches.length === 0 ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {m.scores_empty()}
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {matches.slice(0, visible).map((item) => {
                                const entry = mastery[item.id];
                                return (
                                    <LibraryRow
                                        key={item.id}
                                        item={item}
                                        starred={filters.favorites.has(item.id)}
                                        learned={entry?.learned ?? false}
                                        due={entry !== undefined && isDue(entry, now)}
                                        onToggleStar={() => favoritesStore.toggle(item.id)}
                                        onRemove={
                                            item.removable
                                                ? () => {
                                                      remove(item.id);
                                                      searchRef.current?.focus();
                                                  }
                                                : undefined
                                        }
                                        removeConfirmLabel={
                                            item.removable ? removeConfirmLabel(item.id) : undefined
                                        }
                                    />
                                );
                            })}
                        </ul>
                    )}

                    <Show when={visible < matches.length}>
                        <Button variant="secondary" onClick={filters.showMore}>
                            {m.library_show_more()}
                        </Button>
                    </Show>

                    <ScoreBackup />
                </>
            )}
        </main>
    );
}
