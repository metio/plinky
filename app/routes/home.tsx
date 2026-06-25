// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useState } from "react";
import { LocalizedLink as Link } from "../components/localizedLink";
import { ScoreImport } from "../components/scoreImport";
import { loadCatalog, type Score } from "../lib/catalog";
import { loadFavorites, toggleFavorite } from "../lib/favorites";
import { SITE_DESCRIPTION, SITE_TITLE, socialMeta, STRUCTURED_DATA } from "../lib/site";
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
    const [scores, setScores] = useState<Score[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [loaded, setLoaded] = useState(false);

    // The catalogue reads from local storage and bundled MusicXML on the client,
    // so it appears a tick after paint; a skeleton of the same height holds the
    // space until then so the import panel below does not jump.
    useEffect(() => {
        setScores(loadCatalog());
        setFavorites(loadFavorites());
        setLoaded(true);
    }, []);

    const toggle = (id: string) => setFavorites(new Set(toggleFavorite(id)));

    const favoriteScores = useMemo(
        () => scores.filter((score) => favorites.has(score.id)),
        [scores, favorites],
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
                        <Link to="/scores" className={NAV_LINK}>
                            {m.home_browse_all()}
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
                    <div className="h-24" aria-hidden="true" />
                ) : favoriteScores.length === 0 ? (
                    <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                        {m.home_favorites_empty()}{" "}
                        <Link to="/scores" className={NAV_LINK}>
                            {m.home_browse_all()}
                        </Link>
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {favoriteScores.map((score) => (
                            <li
                                key={score.id}
                                className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800"
                            >
                                <Link
                                    to={`/play/${score.id}`}
                                    className="font-medium text-indigo-700 underline dark:text-indigo-300"
                                >
                                    {score.title}
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => toggle(score.id)}
                                    aria-label={m.scores_unfavorite()}
                                    className="text-lg leading-none text-amber-600 dark:text-amber-400"
                                >
                                    ★
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <ScoreImport
                existingIds={scores.map((score) => score.id)}
                onAdded={() => setScores(loadCatalog())}
            />
        </main>
    );
}
