// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, IconButton } from "../components/ui/button";
import { linkClasses } from "../components/ui/classes";
import { ConfirmButton } from "../components/ui/confirmButton";
import { Chip } from "../components/ui/chip";
import { Show } from "../components/features/conditional";
import { CheckIcon, ClockIcon, CloseIcon, StarIcon } from "../components/ui/icons";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { ScoreBackup } from "../components/features/scoreBackup";
import { GradeChip } from "../components/features/scoreGrade";
import { loadCatalog, removeUserScore } from "../lib/catalog";
import { isDue, type Mastery } from "../../core/mastery";
import { useFavoritesStore, useServices } from "../contexts/services";
import { useFavorites } from "../hooks/useFavorites";
import { gradeOf, MAX_GRADE } from "../../core/scoreDifficulty";
import { routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/library";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.library_heading(), m.meta_library_description());
}

const PER_PAGE = 60;

// A labelled row of filter chips, so the three filter axes (Kind / Grade / Show) read
// as distinct groups rather than one flat wall of pills.
function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* A minimum, not a fixed, width: the label column aligns across the
                groups for short labels but grows for a longer translation (e.g.
                German "Anzeigen") instead of overflowing into the first chip. */}
            <span className="min-w-12 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </span>
            {children}
        </div>
    );
}

// A unified row, tagged by kind so the catalogue can be filtered into songs,
// generated scales/arpeggios, and curated studies. Exercises and songs carry a
// precomputed grade from their manifest; local scores are graded from their inlined
// MusicXML. Only user imports are removable; exercises/songs fetch on open.
type Kind = "song" | "scale-arpeggio" | "study";
type Item = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    removable: boolean;
    kind: Kind;
};

export default function LibraryRoute() {
    const services = useServices();
    const masteryStore = services.mastery;
    const [local, setLocal] = useState<Item[]>([]);
    const [exercises, setExercises] = useState<Item[]>([]);
    const [songs, setSongs] = useState<Item[]>([]);
    // Subscribed, not mirrored: starring anywhere (this list, seeding) re-renders here.
    const favoritesStore = useFavoritesStore();
    const favorites = useFavorites();
    const [masteryMap, setMasteryMap] = useState<Record<string, Mastery>>({});
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState("");
    const [kindFilter, setKindFilter] = useState<Kind | "">(""); // "" = all kinds
    // A set of selected grades; empty means every grade. Multi-select, so a player can
    // line up e.g. grades 3 and 4 at once — each chip still means exactly that grade.
    const [selectedGrades, setSelectedGrades] = useState<Set<number>>(new Set());
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [dueOnly, setDueOnly] = useState(false);
    const [visible, setVisible] = useState(PER_PAGE);
    const searchRef = useRef<HTMLInputElement>(null);

    const reloadMastery = useCallback(() => {
        const map: Record<string, Mastery> = {};
        for (const { id, value } of masteryStore.loadAll()) {
            map[id] = value;
        }
        setMasteryMap(map);
    }, [masteryStore]);

    const reloadLocal = useCallback(() => {
        setLocal(
            loadCatalog(services.store).map((score) => ({
                id: score.id,
                title: score.title,
                composer: score.composer,
                grade: gradeOf(services.xml, score.id, score.xml),
                removable: !score.bundled,
                kind: "song" as const,
            })),
        );
    }, [services.xml, services.store]);

    useEffect(() => {
        reloadLocal();
        reloadMastery();
        // The exercise and song manifests load over the network; local scores render
        // first. Exercises are always present; the song catalogue is the deep library.
        Promise.all([services.exercises.manifest(), services.songs.manifest()]).then(
            ([exerciseList, manifest]) => {
                setExercises(
                    exerciseList.map((exercise) => ({
                        id: exercise.id,
                        title: exercise.title,
                        composer: exercise.composer ?? "",
                        grade: exercise.grade,
                        removable: false,
                        kind: exercise.kind,
                    })),
                );
                setSongs(
                    manifest.map((song) => ({
                        id: song.id,
                        title: song.title,
                        composer: song.composer,
                        grade: song.grade,
                        removable: false,
                        kind: "song" as const,
                    })),
                );
                setLoaded(true);
            },
        );
    }, [reloadLocal, reloadMastery, services.songs.manifest, services.exercises.manifest]);

    // A new filter starts from the top of its (possibly long) result set.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when the filter changes
    useEffect(
        () => setVisible(PER_PAGE),
        [query, kindFilter, selectedGrades, favoritesOnly, dueOnly],
    );

    const toggle = (id: string) => favoritesStore.toggle(id);
    const remove = (id: string) => {
        removeUserScore(services.store, id);
        reloadLocal();
        searchRef.current?.focus();
    };

    const now = Date.now();
    const dueCount = Object.values(masteryMap).filter((mastery) => isDue(mastery, now)).length;

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const at = Date.now();
        // An imported score can share a fingerprint id with a catalogue piece (import
        // only warns, it still saves). Keep the first occurrence so the combined list
        // has no duplicate id — which would collide as a React key and render twice.
        const seen = new Set<string>();
        return [...local, ...exercises, ...songs].filter((item) => {
            if (seen.has(item.id)) {
                return false;
            }
            seen.add(item.id);
            if (kindFilter && item.kind !== kindFilter) {
                return false;
            }
            if (selectedGrades.size > 0 && !selectedGrades.has(item.grade)) {
                return false;
            }
            if (favoritesOnly && !favorites.has(item.id)) {
                return false;
            }
            if (dueOnly) {
                const mastery = masteryMap[item.id];
                if (!mastery || !isDue(mastery, at)) {
                    return false;
                }
            }
            if (!needle) {
                return true;
            }
            return (
                item.title.toLowerCase().includes(needle) ||
                item.composer.toLowerCase().includes(needle)
            );
        });
    }, [
        local,
        exercises,
        songs,
        query,
        kindFilter,
        selectedGrades,
        favoritesOnly,
        favorites,
        dueOnly,
        masteryMap,
    ]);

    const grades = Array.from({ length: MAX_GRADE }, (_, i) => i + 1);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.library_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.library_intro()}</p>
                <Show when={dueCount > 0}>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {m.mastery_due_count({ count: dueCount })}
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
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={m.scores_search_placeholder()}
                aria-label={m.scores_search_placeholder()}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />

            {/* Three labelled groups so the chips read as Kind / Grade / Show rather
                than one undifferentiated wall, and the toggles (Show) sit apart from the
                single-select Kind and Grade. */}
            <FilterGroup label={m.library_group_kind()}>
                <Chip selected={kindFilter === ""} onClick={() => setKindFilter("")}>
                    {m.scores_filter_all()}
                </Chip>
                {(
                    [
                        ["song", m.library_kind_songs()],
                        ["scale-arpeggio", m.library_kind_scales()],
                        ["study", m.library_kind_studies()],
                    ] as [Kind, string][]
                ).map(([kind, label]) => (
                    <Chip
                        key={kind}
                        selected={kindFilter === kind}
                        onClick={() => setKindFilter(kind)}
                    >
                        {label}
                    </Chip>
                ))}
            </FilterGroup>

            <FilterGroup label={m.library_group_grade()}>
                <Chip
                    selected={selectedGrades.size === 0}
                    onClick={() => setSelectedGrades(new Set())}
                >
                    {m.scores_filter_all()}
                </Chip>
                {grades.map((grade) => (
                    <Chip
                        key={grade}
                        selected={selectedGrades.has(grade)}
                        aria-pressed={selectedGrades.has(grade)}
                        onClick={() =>
                            setSelectedGrades((prev) => {
                                const next = new Set(prev);
                                if (next.has(grade)) {
                                    next.delete(grade);
                                } else {
                                    next.add(grade);
                                }
                                return next;
                            })
                        }
                        aria-label={m.score_grade({ grade })}
                        className="tabular-nums"
                    >
                        {grade}
                    </Chip>
                ))}
            </FilterGroup>

            <FilterGroup label={m.library_group_show()}>
                <Chip
                    selected={favoritesOnly}
                    aria-pressed={favoritesOnly}
                    onClick={() => setFavoritesOnly((on) => !on)}
                >
                    {m.scores_filter_favorites()}
                </Chip>
                <Show when={dueCount > 0}>
                    <Chip
                        selected={dueOnly}
                        aria-pressed={dueOnly}
                        onClick={() => setDueOnly((on) => !on)}
                    >
                        {m.library_filter_due()}
                    </Chip>
                </Show>
            </FilterGroup>

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
                                const mastery = masteryMap[item.id];
                                const starred = favorites.has(item.id);
                                return (
                                    <li key={item.id} className="flex items-center gap-2">
                                        <IconButton
                                            variant="ghost"
                                            onClick={() => toggle(item.id)}
                                            aria-pressed={starred}
                                            label={
                                                starred
                                                    ? m.scores_unfavorite()
                                                    : m.scores_favorite()
                                            }
                                            className={
                                                starred
                                                    ? "text-amber-500 dark:text-amber-400"
                                                    : "text-gray-400"
                                            }
                                        >
                                            <StarIcon className="h-5 w-5" filled={starred} />
                                        </IconButton>
                                        <Link
                                            to={`/play/${item.id}`}
                                            // min-w-0 lets this flex child shrink below its
                                            // content so a long title truncates instead of
                                            // pushing the row — and the whole page — wider than
                                            // the viewport (which would clip the fixed bottom nav).
                                            className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-medium">
                                                    {item.title}
                                                    {mastery?.learned && (
                                                        <span className="ml-1 inline-flex items-center text-green-600 dark:text-green-400">
                                                            <CheckIcon className="h-4 w-4" />
                                                            <span className="sr-only">
                                                                {m.mastery_learned()}
                                                            </span>
                                                        </span>
                                                    )}
                                                    {mastery && isDue(mastery, now) && (
                                                        <span className="ml-1 inline-flex items-center text-amber-600 dark:text-amber-400">
                                                            <ClockIcon className="h-4 w-4" />
                                                            <span className="sr-only">
                                                                {m.mastery_due()}
                                                            </span>
                                                        </span>
                                                    )}
                                                </span>
                                                {item.composer && (
                                                    <span className="block truncate text-xs text-gray-600 dark:text-gray-400">
                                                        {item.composer}
                                                    </span>
                                                )}
                                            </span>
                                            <GradeChip grade={item.grade} />
                                        </Link>
                                        {item.removable && (
                                            <ConfirmButton
                                                variant="ghost"
                                                onConfirm={() => remove(item.id)}
                                                confirmLabel={m.action_remove_confirm()}
                                                label={m.action_remove()}
                                                className="text-red-600 dark:text-red-400"
                                            >
                                                <CloseIcon className="h-5 w-5" />
                                            </ConfirmButton>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <Show when={visible < matches.length}>
                        <Button
                            variant="secondary"
                            onClick={() => setVisible((count) => count + PER_PAGE)}
                        >
                            {m.library_show_more()}
                        </Button>
                    </Show>

                    <ScoreBackup />

                    <Link to="/" className={`text-sm ${linkClasses}`}>
                        {m.action_back_home()}
                    </Link>
                </>
            )}
        </main>
    );
}
