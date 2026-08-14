// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Show } from "../components/features/conditional";
import { LibraryFilters } from "../components/features/libraryFilters";
import { LibraryRow } from "../components/features/libraryRow";
import { ScoreBackup } from "../components/features/scoreBackup";
import { ScoreImport } from "../components/features/scoreImport";
import { Button } from "../components/ui/button";
import { HubList } from "../components/ui/hubList";
import { KeysIcon } from "../components/ui/icons";
import { SegmentedControl } from "../components/ui/segmentedControl";
import { dueCount } from "../../core/library";
import { isDue } from "../../core/mastery";
import { routeMeta } from "../../core/site";
import { useFavoritesStore } from "../contexts/services";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { useLibraryItems } from "../hooks/useLibraryItems";
import { useSynth } from "../hooks/useSynth";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/library";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.nav_music(), m.meta_library_description());
}

// The library's two jobs as two tabs: Search finds something to play in the
// combined catalogue; Manage grows it (add your own score) and keeps it safe
// (backup and restore). ?tab=manage deep-links straight to the second.
type LibraryTab = "search" | "manage";

// Music is everything there is to play, and the catalogue is only half of it: the
// other half is what you make yourself. Compose used to be a home-page tile, which
// left the shelf looking like a catalogue and nothing else. (A set of pieces in a
// deliberate order is a course of study, so assignments live on Learn.)
const SHELVES = [
    {
        to: "/compose",
        label: m.play_compose,
        blurb: m.play_compose_blurb,
        Icon: KeysIcon,
        note: 67,
    },
];

export default function LibraryRoute() {
    const synth = useSynth();
    const favoritesStore = useFavoritesStore();
    const { items, mastery, loaded, remove, assignmentsUsing } = useLibraryItems();
    const filters = useLibraryFilters(items, mastery);
    const searchRef = useRef<HTMLInputElement>(null);
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState<LibraryTab>(
        searchParams.get("tab") === "manage" ? "manage" : "search",
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
            <header className="space-y-1">
                {/* The page is named for the tab that leads here: a bar that teaches a
                    model only works while the place agrees with the word on it. */}
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                    {m.nav_music()}
                </h1>
                <p className="text-sm text-muted">{m.library_intro()}</p>
            </header>

            <HubList
                entries={SHELVES.map((shelf) => ({
                    ...shelf,
                    label: shelf.label(),
                    blurb: shelf.blurb(),
                }))}
                onEnter={(note) =>
                    synth.playNote(note, { velocity: 55, duration: 0.4, decorative: true })
                }
            />

            <SegmentedControl
                options={[
                    { id: "search", label: m.library_tab_search() },
                    { id: "manage", label: m.library_tab_manage() },
                ]}
                value={tab}
                onChange={setTab}
                label={m.library_tabs_label()}
            />

            {tab === "manage" ? (
                <>
                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold">{m.import_heading()}</h2>
                        <p className="text-sm text-muted">{m.import_intro()}</p>
                        <p className="text-sm text-muted">{m.import_local_note()}</p>
                    </section>
                    <ScoreImport />
                    <ScoreBackup />
                </>
            ) : (
                <>
                    <input
                        ref={searchRef}
                        type="search"
                        value={filters.query}
                        onChange={(event) => filters.setQuery(event.target.value)}
                        placeholder={m.scores_search_placeholder()}
                        aria-label={m.scores_search_placeholder()}
                        className="w-full rounded-md border border-line-strong px-3 py-2 text-sm dark:bg-raised"
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
