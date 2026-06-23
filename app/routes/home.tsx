// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { SongImport } from "../components/songImport";
import type { Exercise } from "../lib/exercises";
import { seedStarterSongs } from "../lib/seed";
import { encodeSong } from "../lib/share";
import { SITE_DESCRIPTION, SITE_TITLE, socialMeta, STRUCTURED_DATA } from "../lib/site";
import { loadUserSongs, removeUserSong, toAbcDocument } from "../lib/songs";
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

// Message functions are called at render time so the labels follow the locale.
const MODES = [
    { slug: "practice", label: m.mode_practice },
    { slug: "time-trial", label: m.mode_time_trial },
    { slug: "rhythm", label: m.mode_rhythm },
    { slug: "tempo", label: m.mode_tempo },
    { slug: "loop", label: m.mode_loop },
];

const PLAY_NOW = [
    { to: "/sprint", label: m.play_sprint, blurb: m.play_sprint_blurb },
    { to: "/daily", label: m.play_daily, blurb: m.play_daily_blurb },
    { to: "/ear", label: m.play_ear, blurb: m.play_ear_blurb },
];

function downloadAbc(exercise: Exercise): void {
    const blob = new Blob([toAbcDocument(exercise)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${exercise.id}.abc`;
    anchor.click();
    URL.revokeObjectURL(url);
}

export default function Home() {
    const [songs, setSongs] = useState<Exercise[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const reload = useCallback(() => setSongs(loadUserSongs()), []);

    // Seed the starter songs on first run, then show whatever is on the device.
    // seedStarterSongs is a no-op once seeded, so this just reloads on return.
    useEffect(() => {
        seedStarterSongs().then(reload);
    }, [reload]);

    const remove = (id: string) => {
        removeUserSong(id);
        reload();
    };

    // A self-contained link that imports the song on open — no account, no server.
    const share = (exercise: Exercise) => {
        const url = `${window.location.origin}/import#s=${encodeSong(toAbcDocument(exercise))}`;
        navigator.clipboard?.writeText(url);
        setCopiedId(exercise.id);
        window.setTimeout(
            () => setCopiedId((current) => (current === exercise.id ? null : current)),
            2000,
        );
    };

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.home_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.home_intro()}</p>
            </header>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
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
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {mode.blurb()}
                            </p>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
                        {m.home_practice_a_song()}
                    </h2>
                    <div className="flex gap-4 text-sm">
                        <Link
                            to="/curriculums"
                            className="text-indigo-700 underline dark:text-indigo-300"
                        >
                            {m.home_by_curriculum()}
                        </Link>
                        <Link
                            to="/import"
                            className="text-indigo-700 underline dark:text-indigo-300"
                        >
                            {m.home_find_more_songs()}
                        </Link>
                    </div>
                </div>

                {songs.length === 0 ? (
                    <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        {m.home_empty_prefix()}{" "}
                        <Link
                            to="/import"
                            className="text-indigo-700 underline dark:text-indigo-300"
                        >
                            {m.home_find_to_import()}
                        </Link>
                        {m.home_empty_suffix()}
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {songs.map((exercise) => (
                            <li
                                key={exercise.id}
                                className="rounded-md border border-gray-200 p-4 dark:border-gray-800"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h3 className="text-lg font-medium">{exercise.title}</h3>
                                    <span className="font-mono text-xs text-gray-400">
                                        {m.home_bpm({ tempo: exercise.tempo })}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {exercise.description}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {MODES.map((mode) => (
                                        <Link
                                            key={mode.slug}
                                            to={`/${mode.slug}/${exercise.id}`}
                                            className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                                        >
                                            {mode.label()}
                                        </Link>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => share(exercise)}
                                        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 underline dark:text-gray-300"
                                    >
                                        {copiedId === exercise.id
                                            ? m.action_link_copied()
                                            : m.action_share()}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => downloadAbc(exercise)}
                                        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 underline dark:text-gray-300"
                                    >
                                        {m.action_export()}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => remove(exercise.id)}
                                        className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 underline"
                                    >
                                        {m.action_remove()}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <SongImport existingIds={songs.map((exercise) => exercise.id)} onAdded={reload} />
        </main>
    );
}
