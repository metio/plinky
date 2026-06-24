// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { SongCard } from "../components/songCard";
import { SongImport } from "../components/songImport";
import { usePlayer } from "../hooks/usePlayer";
import type { Exercise } from "../lib/exercises";
import { loadFavorites, toggleFavorite } from "../lib/favorites";
import { seedStarterSongs } from "../lib/seed";
import { SITE_DESCRIPTION, SITE_TITLE, socialMeta, STRUCTURED_DATA } from "../lib/site";
import { loadUserSongs, removeUserSong } from "../lib/songs";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
    // React Router renders the "script:ld+json" descriptor as a JSON-LD <script>,
    // serializing it safely — no dangerouslySetInnerHTML needed.
    return [
        { title: SITE_TITLE },
        { name: "description", content: SITE_DESCRIPTION },
        ...socialMeta(SITE_TITLE, SITE_DESCRIPTION),
        { "script:ld+json": STRUCTURED_DATA },
    ];
}

const PLAY_NOW = [
    { to: "/sprint", label: m.play_sprint, blurb: m.play_sprint_blurb },
    { to: "/daily", label: m.play_daily, blurb: m.play_daily_blurb },
    { to: "/ear", label: m.play_ear, blurb: m.play_ear_blurb },
];

const NAV_LINK = "text-indigo-700 underline dark:text-indigo-300";

export default function Home() {
    const [songs, setSongs] = useState<Exercise[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [loaded, setLoaded] = useState(false);
    const player = usePlayer();
    const reload = useCallback(() => setSongs(loadUserSongs()), []);

    // The catalog lives in local storage, unavailable during prerender and on the
    // first client paint, so it can only appear a tick later. Until then a
    // skeleton of the same height stands in, so populating the list does not
    // shove the rest of the page down.
    // seedStarterSongs is a no-op once seeded, so this just reloads on return.
    useEffect(() => {
        seedStarterSongs().then(() => {
            reload();
            setFavorites(loadFavorites());
            setLoaded(true);
        });
    }, [reload]);

    const toggle = (id: string) => setFavorites(new Set(toggleFavorite(id)));
    const remove = (id: string) => {
        removeUserSong(id);
        reload();
    };

    // The home list is the user's pinned songs, so a large catalog stays out of
    // the way; the full library lives on /songs.
    const favoriteSongs = useMemo(
        () => songs.filter((song) => favorites.has(song.id)),
        [songs, favorites],
    );

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.home_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.home_intro()}</p>
            </header>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.home_play_now()}
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                    {PLAY_NOW.map((mode) => (
                        <Link
                            key={mode.to}
                            to={mode.to}
                            className="block rounded-md border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:hover:bg-indigo-900"
                        >
                            <span className="font-medium text-indigo-700 dark:text-indigo-300">
                                {mode.label()} →
                            </span>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {mode.blurb()}
                            </p>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {m.home_favorites_heading()}
                    </h2>
                    <div className="flex gap-4 text-sm">
                        <Link to="/songs" className={NAV_LINK}>
                            {m.home_browse_all()}
                        </Link>
                        <Link to="/scores" className={NAV_LINK}>
                            {m.scores_heading()}
                        </Link>
                        <Link to="/tracks" className={NAV_LINK}>
                            {m.home_tracks()}
                        </Link>
                        <Link to="/curriculums" className={NAV_LINK}>
                            {m.home_by_curriculum()}
                        </Link>
                    </div>
                </div>

                {!loaded ? (
                    // Favorites load from local storage a tick after paint. Reserve
                    // about the height of the empty prompt so resolving the list
                    // does not shove the import panel below it up or down.
                    <div className="h-24" aria-hidden="true" />
                ) : favoriteSongs.length === 0 ? (
                    <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                        {m.home_favorites_empty()}{" "}
                        <Link to="/songs" className={NAV_LINK}>
                            {m.home_browse_all()}
                        </Link>
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {favoriteSongs.map((song) => (
                            <SongCard
                                key={song.id}
                                song={song}
                                favorite={true}
                                onToggleFavorite={toggle}
                                onRemove={remove}
                                playing={player.playingId === song.id}
                                onPlay={(s) => player.play(s.id, s.abc, s.tempo)}
                                onStop={player.stop}
                            />
                        ))}
                    </ul>
                )}
            </section>

            <SongImport existingIds={songs.map((song) => song.id)} onAdded={reload} />
        </main>
    );
}
