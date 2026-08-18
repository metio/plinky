// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { Show } from "../components/features/conditional";
import { MusicFilters } from "../components/features/musicFilters";
import { MusicRow } from "../components/features/musicRow";
import { ScoreBackup } from "../components/features/scoreBackup";
import { ScoreImport } from "../components/features/scoreImport";
import { Button } from "../components/ui/button";
import { SegmentedControl } from "../components/ui/segmentedControl";
import { dueCount } from "../../core/music";
import { isDue } from "../../core/mastery";
import { composerCounts } from "../../core/person";
import { routeMeta } from "../../core/site";
import { useFavoritesStore } from "../contexts/services";
import { useMusicFilters } from "../hooks/useMusicFilters";
import { useMusicItems } from "../hooks/useMusicItems";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/music";
import { PageHeader } from "../components/ui/pageHeader";
import { sectionHeadingClasses } from "../components/ui/classes";
import { YourTakes } from "../components/features/yourTakes";
import { ComposerList } from "../components/features/composerList";
import { fieldClasses } from "../components/ui/classes";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.music_title(), m.meta_music_description());
}

// Music's two jobs as two tabs: Search finds something to play in the
// combined catalogue; Manage grows it (add your own score) and keeps it safe
// (backup and restore). ?tab=manage deep-links straight to the second.
type MusicTab = "search" | "people" | "manage";

export default function MusicRoute() {
    const favoritesStore = useFavoritesStore();
    const { items, mastery, loaded, remove, assignmentsUsing } = useMusicItems();
    const [searchParams, setSearchParams] = useSearchParams();
    // ?grade=6 opens the shelf on that grade — the roadmap's rows link here, so pressing
    // a grade you have not reached lands on its pieces rather than on an explanation.
    const filters = useMusicFilters(items, mastery);
    const searchRef = useRef<HTMLInputElement>(null);
    // The tab rides in the address beside the filters, so a piece opened from the shelf and
    // then left comes back to the list it was opened from.
    const param = searchParams.get("tab");
    const tab: MusicTab = param === "manage" ? "manage" : param === "people" ? "people" : "search";
    const setTab = (next: MusicTab) =>
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
            ? m.music_remove_used_one({ count: used })
            : m.music_remove_used_other({ count: used });
    };

    // The composers this shelf actually holds, grouped from the same items it lists — so
    // the directory and the search agree about who is in the catalogue. Grouping three
    // thousand credits is ~10ms, so it waits until somebody asks to see them.
    const people = useMemo(() => (tab === "people" ? composerCounts(items) : []), [tab, items]);

    const now = Date.now();
    const due = dueCount(mastery, now);
    const { matches, visible } = filters;

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.music_title()} hint={m.music_intro()} />

            <SegmentedControl
                options={[
                    { id: "search", label: m.music_tab_search() },
                    { id: "people", label: m.music_tab_people() },
                    { id: "manage", label: m.music_tab_manage() },
                ]}
                value={tab}
                onChange={setTab}
                label={m.music_tabs_label()}
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
                    <p className="text-sm text-muted">{m.music_people_hint()}</p>
                    <ComposerList people={people} query={filters.applied} />
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
                    <MusicFilters
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
                                            <MusicRow
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
                                                        ? () => removeConfirmLabel(item.id)
                                                        : undefined
                                                }
                                            />
                                        );
                                    })}
                                </ul>
                            )}

                            <Show when={visible < matches.length}>
                                <Button variant="secondary" onClick={filters.showMore}>
                                    {m.music_show_more()}
                                </Button>
                            </Show>
                        </>
                    )}
                </>
            )}
        </main>
    );
}
