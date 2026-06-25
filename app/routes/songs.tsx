// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ScoreViewer } from "../components/scoreViewer";
import { loadCatalog, removeUserSong, type Song } from "../lib/catalog";
import { loadFavorites, toggleFavorite } from "../lib/favorites";
import { isDue, loadAllMastery, type Mastery } from "../lib/mastery";
import { routeMeta } from "../lib/site";
import { loadCurriculums } from "../lib/catalog";
import type { Curriculum } from "../lib/songPack";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/songs";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Songs", "Every piece on this device — rendered, played, and graded");
}

const CHIP = "rounded-full border px-3 py-1 text-sm";
const CHIP_ON = "border-indigo-600 bg-indigo-600 text-white";
const CHIP_OFF =
    "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

export default function SongsRoute() {
    const [songs, setSongs] = useState<Song[]>([]);
    const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [masteryMap, setMasteryMap] = useState<Record<string, Mastery>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [curriculum, setCurriculum] = useState(""); // "" = all
    const [favoritesOnly, setFavoritesOnly] = useState(false);

    const reloadMastery = useCallback(() => {
        const map: Record<string, Mastery> = {};
        for (const { id, mastery } of loadAllMastery()) {
            map[id] = mastery;
        }
        setMasteryMap(map);
    }, []);

    useEffect(() => {
        const loaded = loadCatalog();
        setSongs(loaded);
        setSelectedId((current) => current ?? loaded[0]?.id ?? null);
        setCurriculums(loadCurriculums());
        setFavorites(loadFavorites());
        reloadMastery();
    }, [reloadMastery]);

    const toggle = (id: string) => setFavorites(new Set(toggleFavorite(id)));
    const remove = (id: string) => {
        removeUserSong(id);
        setSongs(loadCatalog());
    };

    const now = Date.now();
    const dueCount = Object.values(masteryMap).filter((mastery) => isDue(mastery, now)).length;

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return songs.filter((song) => {
            if (curriculum && !song.curriculums?.includes(curriculum)) {
                return false;
            }
            if (favoritesOnly && !favorites.has(song.id)) {
                return false;
            }
            if (!needle) {
                return true;
            }
            return (
                song.title.toLowerCase().includes(needle) ||
                song.composer.toLowerCase().includes(needle)
            );
        });
    }, [songs, query, curriculum, favoritesOnly, favorites]);

    const selected = songs.find((song) => song.id === selectedId) ?? null;

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.songs_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.songs_intro()}</p>
                {dueCount > 0 && (
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {m.mastery_due_count({ count: dueCount })}
                    </p>
                )}
            </header>

            <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={m.songs_search_placeholder()}
                aria-label={m.songs_search_placeholder()}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setCurriculum("")}
                    className={`${CHIP} ${curriculum === "" ? CHIP_ON : CHIP_OFF}`}
                >
                    {m.songs_filter_all()}
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
                    {m.songs_filter_favorites()}
                </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
                {m.songs_count({ count: matches.length })}
            </p>

            {matches.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.songs_empty()}</p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {matches.map((song) => {
                        const mastery = masteryMap[song.id];
                        return (
                            <li key={song.id} className="flex items-center">
                                <button
                                    type="button"
                                    onClick={() => toggle(song.id)}
                                    aria-pressed={favorites.has(song.id)}
                                    aria-label={
                                        favorites.has(song.id)
                                            ? m.songs_unfavorite()
                                            : m.songs_favorite()
                                    }
                                    className={`mr-1 text-lg leading-none ${favorites.has(song.id) ? "text-amber-600 dark:text-amber-400" : "text-gray-400 hover:text-amber-600"}`}
                                >
                                    {favorites.has(song.id) ? "★" : "☆"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(song.id)}
                                    aria-pressed={song.id === selectedId}
                                    className={`rounded-md border px-3 py-2 text-left text-sm ${
                                        song.id === selectedId
                                            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
                                            : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    <span className="block font-medium">
                                        {song.title}
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
                                    {song.composer && (
                                        <span className="block text-xs text-gray-600 dark:text-gray-400">
                                            {song.composer}
                                        </span>
                                    )}
                                </button>
                                {!song.bundled && (
                                    <button
                                        type="button"
                                        onClick={() => remove(song.id)}
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

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
