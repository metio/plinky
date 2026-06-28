// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Show } from "../components/conditional";
import { LocalizedLink as Link } from "../components/localizedLink";
import { ScoreBackup } from "../components/scoreBackup";
import { GradeChip } from "../components/scoreGrade";
import { loadCatalog, removeUserScore } from "../lib/catalog";
import { loadExerciseManifest } from "../lib/exercises";
import { loadFavorites, toggleFavorite } from "../lib/favorites";
import { isDue, loadAllMastery, type Mastery } from "../lib/mastery";
import { gradeOf, MAX_GRADE } from "../lib/scoreDifficulty";
import { routeMeta } from "../lib/site";
import { loadManifest } from "../lib/songs";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/library";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.library_heading(), m.meta_library_description());
}

const CHIP = "rounded-full border px-3 py-1 text-sm";
const CHIP_ON = "border-indigo-600 bg-indigo-600 text-white";
const CHIP_OFF =
    "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";
const PER_PAGE = 60;

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
    const [local, setLocal] = useState<Item[]>([]);
    const [exercises, setExercises] = useState<Item[]>([]);
    const [songs, setSongs] = useState<Item[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [masteryMap, setMasteryMap] = useState<Record<string, Mastery>>({});
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState("");
    const [kindFilter, setKindFilter] = useState<Kind | "">(""); // "" = all kinds
    const [gradeFilter, setGradeFilter] = useState(0); // 0 = all grades
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [dueOnly, setDueOnly] = useState(false);
    const [visible, setVisible] = useState(PER_PAGE);
    const searchRef = useRef<HTMLInputElement>(null);

    const reloadMastery = useCallback(() => {
        const map: Record<string, Mastery> = {};
        for (const { id, mastery } of loadAllMastery()) {
            map[id] = mastery;
        }
        setMasteryMap(map);
    }, []);

    const reloadLocal = useCallback(() => {
        setLocal(
            loadCatalog().map((score) => ({
                id: score.id,
                title: score.title,
                composer: score.composer,
                grade: gradeOf(score.id, score.xml),
                removable: !score.bundled,
                kind: "song" as const,
            })),
        );
    }, []);

    useEffect(() => {
        reloadLocal();
        setFavorites(loadFavorites());
        reloadMastery();
        // The exercise and song manifests load over the network; local scores render
        // first. Exercises are always present; the song catalogue is the deep library.
        Promise.all([loadExerciseManifest(), loadManifest()]).then(([exerciseList, manifest]) => {
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
        });
    }, [reloadLocal, reloadMastery]);

    // A new filter starts from the top of its (possibly long) result set.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when the filter changes
    useEffect(() => setVisible(PER_PAGE), [query, kindFilter, gradeFilter, favoritesOnly, dueOnly]);

    const toggle = (id: string) => setFavorites(new Set(toggleFavorite(id)));
    const remove = (id: string) => {
        removeUserScore(id);
        reloadLocal();
        searchRef.current?.focus();
    };

    const now = Date.now();
    const dueCount = Object.values(masteryMap).filter((mastery) => isDue(mastery, now)).length;

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const at = Date.now();
        return [...local, ...exercises, ...songs].filter((item) => {
            if (kindFilter && item.kind !== kindFilter) {
                return false;
            }
            if (gradeFilter && item.grade !== gradeFilter) {
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
        gradeFilter,
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

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setKindFilter("")}
                    className={`${CHIP} ${kindFilter === "" ? CHIP_ON : CHIP_OFF}`}
                >
                    {m.scores_filter_all()}
                </button>
                {(
                    [
                        ["song", m.library_kind_songs()],
                        ["scale-arpeggio", m.library_kind_scales()],
                        ["study", m.library_kind_studies()],
                    ] as [Kind, string][]
                ).map(([kind, label]) => (
                    <button
                        key={kind}
                        type="button"
                        onClick={() => setKindFilter(kind)}
                        className={`${CHIP} ${kindFilter === kind ? CHIP_ON : CHIP_OFF}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setGradeFilter(0)}
                    className={`${CHIP} ${gradeFilter === 0 ? CHIP_ON : CHIP_OFF}`}
                >
                    {m.scores_filter_all()}
                </button>
                {grades.map((grade) => (
                    <button
                        key={grade}
                        type="button"
                        onClick={() => setGradeFilter(grade)}
                        aria-label={m.score_grade({ grade })}
                        className={`${CHIP} tabular-nums ${gradeFilter === grade ? CHIP_ON : CHIP_OFF}`}
                    >
                        {grade}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setFavoritesOnly((on) => !on)}
                    aria-pressed={favoritesOnly}
                    className={`${CHIP} ${favoritesOnly ? CHIP_ON : CHIP_OFF}`}
                >
                    {m.scores_filter_favorites()}
                </button>
                <Show when={dueCount > 0}>
                    <button
                        type="button"
                        onClick={() => setDueOnly((on) => !on)}
                        aria-pressed={dueOnly}
                        className={`${CHIP} ${dueOnly ? CHIP_ON : CHIP_OFF}`}
                    >
                        {m.library_filter_due()}
                    </button>
                </Show>
            </div>

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
                                        <button
                                            type="button"
                                            onClick={() => toggle(item.id)}
                                            aria-pressed={starred}
                                            aria-label={
                                                starred
                                                    ? m.scores_unfavorite()
                                                    : m.scores_favorite()
                                            }
                                            className={`text-lg leading-none ${starred ? "text-amber-600 dark:text-amber-400" : "text-gray-400 hover:text-amber-600"}`}
                                        >
                                            {starred ? "★" : "☆"}
                                        </button>
                                        <Link
                                            to={`/play/${item.id}`}
                                            className="flex flex-1 items-center gap-2 rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-medium">
                                                    {item.title}
                                                    {mastery?.learned && (
                                                        <span className="ml-1 text-green-600 dark:text-green-400">
                                                            ✓
                                                        </span>
                                                    )}
                                                    {mastery && isDue(mastery, now) && (
                                                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                                                            ●
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
                                            <button
                                                type="button"
                                                onClick={() => remove(item.id)}
                                                aria-label={m.action_remove()}
                                                className="text-sm text-red-600 dark:text-red-400"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <Show when={visible < matches.length}>
                        <button
                            type="button"
                            onClick={() => setVisible((count) => count + PER_PAGE)}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                            {m.library_show_more()}
                        </button>
                    </Show>

                    <ScoreBackup />

                    <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                        {m.action_back_home()}
                    </Link>
                </>
            )}
        </main>
    );
}
