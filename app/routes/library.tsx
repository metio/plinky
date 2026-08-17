// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef } from "react";
import { useSearchParams } from "react-router";
import { Show } from "../components/features/conditional";
import { LibraryFilters } from "../components/features/libraryFilters";
import { LibraryRow } from "../components/features/libraryRow";
import { ScoreBackup } from "../components/features/scoreBackup";
import { ScoreImport } from "../components/features/scoreImport";
import { Button } from "../components/ui/button";
import { SegmentedControl } from "../components/ui/segmentedControl";
import { dueCount } from "../../core/library";
import { isDue } from "../../core/mastery";
import { routeMeta } from "../../core/site";
import { useFavoritesStore } from "../contexts/services";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { useLibraryItems } from "../hooks/useLibraryItems";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/library";
import { PageHeader } from "../components/ui/pageHeader";
import { sectionHeadingClasses } from "../components/ui/classes";
import { YourTakes } from "../components/features/yourTakes";
import { ComposerList } from "../components/features/composerList";
import { fieldClasses } from "../components/ui/classes";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.library_title(), m.meta_library_description());
}

// The library's two jobs as two tabs: Search finds something to play in the
// combined catalogue; Manage grows it (add your own score) and keeps it safe
// (backup and restore). ?tab=manage deep-links straight to the second.
type LibraryTab = "search" | "people" | "manage";

export default function LibraryRoute() {
    const favoritesStore = useFavoritesStore();
    const { items, mastery, loaded, remove, assignmentsUsing } = useLibraryItems();
    const [searchParams, setSearchParams] = useSearchParams();
    // ?grade=6 opens the shelf on that grade — the roadmap's rows link here, so pressing
    // a grade you have not reached lands on its pieces rather than on an explanation.
    const filters = useLibraryFilters(items, mastery);
    const searchRef = useRef<HTMLInputElement>(null);
    // The tab rides in the address beside the filters, so a piece opened from the shelf and
    // then left comes back to the list it was opened from.
    const param = searchParams.get("tab");
    const tab: LibraryTab =
        param === "manage" ? "manage" : param === "people" ? "people" : "search";
    const setTab = (next: LibraryTab) =>
        setSearchParams(
            (prev) => {
                const kept = Object.fromEntries(prev);
                if (next === "search") {
                    delete kept.tab;
                    return kept;
                }
                return { ...kept, tab: next };
            },
            { replace: true, preventScrollReset: true },
        );

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
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.library_title()} hint={m.library_intro()} />

            <SegmentedControl
                options={[
                    { id: "search", label: m.library_tab_search() },
                    { id: "people", label: m.library_tab_people() },
                    { id: "manage", label: m.library_tab_manage() },
                ]}
                value={tab}
                onChange={setTab}
                label={m.library_tabs_label()}
            />

            {/* One search box for two lists: the same words find a piece or the person
                who wrote it, which is how somebody actually looks for music. */}
            {tab !== "manage" && (
                <input
                    ref={searchRef}
                    type="search"
                    value={filters.query}
                    onChange={(event) => filters.setQuery(event.target.value)}
                    placeholder={m.scores_search_placeholder()}
                    aria-label={m.scores_search_placeholder()}
                    className={`w-full ${fieldClasses}`}
                />
            )}

            {tab === "people" && (
                <div className="space-y-3">
                    <p className="text-sm text-muted">{m.library_people_hint()}</p>
                    <ComposerList query={filters.applied} />
                </div>
            )}

            {tab === "manage" ? (
                <>
                    {/* Everything of your own, on one shelf: what you recorded, what you
                        brought, and the backup that keeps both. Your takes were reachable
                        only from the piece they belong to, which meant remembering which
                        piece it was. */}
                    <YourTakes />
                    <section className="space-y-2">
                        <h2 className={sectionHeadingClasses}>{m.import_heading()}</h2>
                        <p className="text-sm text-muted">{m.import_intro()}</p>
                        <p className="text-sm text-muted">{m.import_local_note()}</p>
                    </section>
                    <ScoreImport />
                    <ScoreBackup />
                </>
            ) : tab === "people" ? null : (
                <>
                    <LibraryFilters
                        kind={filters.kind}
                        onKind={filters.setKind}
                        grades={filters.grades}
                        onToggleGrade={filters.toggleGrade}
                        onClearGrades={filters.clearGrades}
                        favoritesOnly={filters.favoritesOnly}
                        onToggleFavoritesOnly={filters.toggleFavoritesOnly}
                        dueOnly={filters.dueOnly}
                        freshOnly={filters.freshOnly}
                        onToggleFreshOnly={filters.toggleFreshOnly}
                        onToggleDueOnly={filters.toggleDueOnly}
                        showDue={due > 0}
                    />

                    <p className="text-xs text-muted">
                        {matches.length === 1
                            ? m.scores_count_one({ count: matches.length })
                            : m.scores_count_other({ count: matches.length })}
                    </p>

                    {!loaded ? (
                        <div className="h-64" aria-hidden="true" />
                    ) : (
                        <>
                            {matches.length === 0 ? (
                                <p className="text-sm text-muted">{m.scores_empty()}</p>
                            ) : (
                                <ul className="divide-y divide-line-faint">
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
                                                    item.removable
                                                        ? removeConfirmLabel(item.id)
                                                        : undefined
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
                        </>
                    )}
                </>
            )}
        </main>
    );
}
