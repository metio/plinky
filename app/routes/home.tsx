// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useState } from "react";
import { HeroKeyboard } from "../components/heroKeyboard";
import { LocalizedLink as Link } from "../components/localizedLink";
import { ScoreImport } from "../components/scoreImport";
import { loadCatalog, type Score } from "../lib/catalog";
import { loadFavorites, toggleFavorite } from "../lib/favorites";
import { socialMeta, structuredData } from "../lib/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
    // React Router renders the "script:ld+json" descriptor as a JSON-LD <script>,
    // serializing it safely — no dangerouslySetInnerHTML needed.
    return [
        { title: m.meta_home_title() },
        { name: "description", content: m.meta_home_description() },
        ...socialMeta(m.meta_home_title(), m.meta_home_description()),
        { "script:ld+json": structuredData(getLocale()) },
    ];
}

const PLAY_NOW = [
    { to: "/sprint", label: m.play_sprint, blurb: m.play_sprint_blurb },
    { to: "/daily", label: m.play_daily, blurb: m.play_daily_blurb },
    { to: "/ear", label: m.play_ear, blurb: m.play_ear_blurb },
    { to: "/fingering", label: m.play_fingering, blurb: m.play_fingering_blurb },
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
        <main className="mx-auto max-w-3xl space-y-12 p-6 font-sans">
            <section className="space-y-6 pt-2">
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
                        {m.home_eyebrow()}
                    </p>
                    <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                        {m.home_heading()}
                    </h1>
                    <p className="max-w-xl text-pretty leading-relaxed text-gray-600 dark:text-gray-300">
                        {m.home_intro()}
                    </p>
                </div>

                {/* Signature: a real keyboard you play right here, resting on a staff
                    line. The brand gradient glows behind it; the keys are the one
                    bold, characteristic thing on the page. */}
                <div className="space-y-2">
                    <div className="relative">
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-x-6 -top-8 bottom-2 -z-10 bg-gradient-to-r from-indigo-500/15 via-violet-500/15 to-transparent blur-2xl"
                        />
                        <div
                            aria-hidden="true"
                            className="mx-auto mb-2 h-px max-w-md bg-gradient-to-r from-indigo-500 via-violet-500 to-transparent"
                        />
                        <HeroKeyboard />
                    </div>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        {m.home_keyboard_hint()}
                    </p>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.home_play_now()}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    {PLAY_NOW.map((mode) => (
                        <Link
                            key={mode.to}
                            to={mode.to}
                            className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-700"
                        >
                            <span
                                aria-hidden="true"
                                className="mt-0.5 h-9 w-6 shrink-0 rounded-b-md border border-gray-300 bg-gradient-to-b from-white to-gray-100 transition group-hover:from-green-100 group-hover:to-green-200 dark:border-gray-600 dark:from-gray-100 dark:to-gray-300"
                            />
                            <span className="space-y-1">
                                <span className="block font-medium text-gray-900 group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
                                    {mode.label()} →
                                </span>
                                <span className="block text-sm text-gray-600 dark:text-gray-400">
                                    {mode.blurb()}
                                </span>
                            </span>
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
                    <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
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
                                className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800"
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
