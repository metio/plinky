// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { SongCard } from "../components/songCard";
import type { Curriculum } from "../lib/songPack";
import { usePlayer } from "../hooks/usePlayer";
import type { Exercise } from "../lib/exercises";
import { loadFavorites, toggleFavorite } from "../lib/favorites";
import { routeMeta } from "../lib/site";
import { loadCurriculums, loadUserSongs, removeUserSong } from "../lib/songs";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/songs";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Songs", "Search, filter, and star every song on this device");
}

const CHIP = "rounded-full border px-3 py-1 text-sm";
const CHIP_ON = "border-indigo-600 bg-indigo-600 text-white";
const CHIP_OFF =
    "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

export default function SongsRoute() {
    const [songs, setSongs] = useState<Exercise[]>([]);
    const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [query, setQuery] = useState("");
    const [curriculum, setCurriculum] = useState(""); // "" = all
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const player = usePlayer();

    useEffect(() => {
        setSongs(loadUserSongs());
        setCurriculums(loadCurriculums());
        setFavorites(loadFavorites());
    }, []);

    const toggle = (id: string) => setFavorites(new Set(toggleFavorite(id)));
    const remove = (id: string) => {
        removeUserSong(id);
        setSongs(loadUserSongs());
    };

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
                song.description.toLowerCase().includes(needle)
            );
        });
    }, [songs, query, curriculum, favoritesOnly, favorites]);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.songs_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.songs_intro()}</p>
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
                <ul className="space-y-3">
                    {matches.map((song) => (
                        <SongCard
                            key={song.id}
                            song={song}
                            favorite={favorites.has(song.id)}
                            onToggleFavorite={toggle}
                            onRemove={remove}
                            playing={player.playingId === song.id}
                            onPlay={(s) => player.play(s.id, s.abc, s.tempo)}
                            onStop={player.stop}
                        />
                    ))}
                </ul>
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
