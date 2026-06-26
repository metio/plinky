// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocalizedLink as Link } from "../components/localizedLink";
import { ScoreImport } from "../components/scoreImport";
import { ScoreViewer } from "../components/scoreViewer";
import {
    loadCatalog,
    loadCurriculums,
    removeUserScore,
    type Score,
    submissionUrl,
} from "../lib/catalog";
import { loadFavorites, toggleFavorite } from "../lib/favorites";
import { isDue, loadAllMastery, type Mastery } from "../lib/mastery";
import type { Curriculum } from "../lib/scorePack";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/library";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.library_heading(), m.meta_library_description());
}

const CHIP = "rounded-full border px-3 py-1 text-sm";
const CHIP_ON = "border-indigo-600 bg-indigo-600 text-white";
const CHIP_OFF =
    "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

export default function ScoresRoute() {
    const [scores, setScores] = useState<Score[]>([]);
    const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [masteryMap, setMasteryMap] = useState<Record<string, Mastery>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState("");
    const [curriculum, setCurriculum] = useState(""); // "" = all
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    const reloadMastery = useCallback(() => {
        const map: Record<string, Mastery> = {};
        for (const { id, mastery } of loadAllMastery()) {
            map[id] = mastery;
        }
        setMasteryMap(map);
    }, []);

    // The catalogue loads on the client. The list renders only once it's ready (a
    // reserved skeleton holds the space meanwhile), and no score is auto-opened —
    // both kept the heavy viewer and the list from shifting the page in late.
    useEffect(() => {
        setScores(loadCatalog());
        setCurriculums(loadCurriculums());
        setFavorites(loadFavorites());
        reloadMastery();
        setLoaded(true);
    }, [reloadMastery]);

    const toggle = (id: string) => setFavorites(new Set(toggleFavorite(id)));
    const remove = (id: string) => {
        removeUserScore(id);
        const next = loadCatalog();
        setScores(next);
        // Don't leave the selection pointing at the removed score: an id later
        // reused by a re-import would otherwise silently reopen its viewer.
        setSelectedId((current) => (current === id ? (next[0]?.id ?? null) : current));
        // The remove button just unmounted; move focus to a stable spot rather
        // than letting it fall back to the document body.
        searchRef.current?.focus();
    };

    const now = Date.now();
    const dueCount = Object.values(masteryMap).filter((mastery) => isDue(mastery, now)).length;

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return scores.filter((score) => {
            if (curriculum && !score.curriculums?.includes(curriculum)) {
                return false;
            }
            if (favoritesOnly && !favorites.has(score.id)) {
                return false;
            }
            if (!needle) {
                return true;
            }
            return (
                score.title.toLowerCase().includes(needle) ||
                score.composer.toLowerCase().includes(needle)
            );
        });
    }, [scores, query, curriculum, favoritesOnly, favorites]);

    // Resolve the selection within the filtered list so a score hidden by the
    // search, curriculum, or favorites filter also hides its viewer, instead of
    // leaving it open below a list that no longer contains (or highlights) it.
    const selected = matches.find((score) => score.id === selectedId) ?? null;

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.library_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.library_intro()}</p>
                {dueCount > 0 && (
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {m.mastery_due_count({ count: dueCount })}
                    </p>
                )}
            </header>

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
                    onClick={() => setCurriculum("")}
                    className={`${CHIP} ${curriculum === "" ? CHIP_ON : CHIP_OFF}`}
                >
                    {m.scores_filter_all()}
                </button>
                {curriculums.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => setCurriculum(entry.id)}
                        className={`${CHIP} ${curriculum === entry.id ? CHIP_ON : CHIP_OFF}`}
                    >
                        {entry.name}
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
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
                {matches.length === 1
                    ? m.scores_count_one({ count: matches.length })
                    : m.scores_count_other({ count: matches.length })}
            </p>

            {!loaded ? (
                <div className="h-64" aria-hidden="true" />
            ) : matches.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.scores_empty()}</p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {matches.map((score) => {
                        const mastery = masteryMap[score.id];
                        return (
                            <li key={score.id} className="flex items-center">
                                <button
                                    type="button"
                                    onClick={() => toggle(score.id)}
                                    aria-pressed={favorites.has(score.id)}
                                    aria-label={
                                        favorites.has(score.id)
                                            ? m.scores_unfavorite()
                                            : m.scores_favorite()
                                    }
                                    className={`mr-1 text-lg leading-none ${favorites.has(score.id) ? "text-amber-600 dark:text-amber-400" : "text-gray-400 hover:text-amber-600"}`}
                                >
                                    {favorites.has(score.id) ? "★" : "☆"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(score.id)}
                                    aria-pressed={score.id === selectedId}
                                    className={`rounded-md border px-3 py-2 text-left text-sm ${
                                        score.id === selectedId
                                            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
                                            : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    <span className="block font-medium">
                                        {score.title}
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
                                    {score.composer && (
                                        <span className="block text-xs text-gray-600 dark:text-gray-400">
                                            {score.composer}
                                        </span>
                                    )}
                                </button>
                                {!score.bundled && (
                                    <button
                                        type="button"
                                        onClick={() => remove(score.id)}
                                        aria-label={m.action_remove()}
                                        className="ml-1 text-sm text-red-600 dark:text-red-400"
                                    >
                                        ✕
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {selected && (
                <ScoreViewer
                    key={selected.id}
                    id={selected.id}
                    xml={selected.xml}
                    title={selected.title}
                    initialTempo={selected.tempo}
                    onMastery={reloadMastery}
                />
            )}

            {/* Held back until the catalogue loads so, while the list is still a
                skeleton, nothing sits below it to be shoved down when it fills in. */}
            {loaded && (
                <>
                    <section className="space-y-3 border-t border-gray-200 pt-6 dark:border-gray-800">
                        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {m.library_add()}
                        </h2>
                        <ScoreImport
                            existingIds={scores.map((score) => score.id)}
                            onAdded={() => setScores(loadCatalog())}
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {m.import_share_prefix()}{" "}
                            <a
                                href={submissionUrl()}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-700 underline dark:text-indigo-300"
                            >
                                {m.import_share_link()}
                            </a>
                        </p>
                    </section>

                    <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                        {m.action_back_home()}
                    </Link>
                </>
            )}
        </main>
    );
}
