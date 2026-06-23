// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { SongImport } from "../components/songImport";
import { type Exercise, exercises } from "../lib/exercises";
import { encodeSong } from "../lib/share";
import { STRUCTURED_DATA } from "../lib/site";
import { loadUserSongs, removeUserSong, toAbcDocument } from "../lib/songs";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
    // React Router renders the "script:ld+json" descriptor as a JSON-LD <script>,
    // serializing it safely — no dangerouslySetInnerHTML needed.
    return [
        { title: "Plinky" },
        { name: "description", content: "Practice piano with your MIDI keyboard." },
        { "script:ld+json": STRUCTURED_DATA },
    ];
}

const MODES = [
    { slug: "practice", label: "Practice" },
    { slug: "time-trial", label: "Time trial" },
    { slug: "rhythm", label: "Rhythm" },
    { slug: "tempo", label: "Tempo" },
    { slug: "loop", label: "Loop" },
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
    const [userSongs, setUserSongs] = useState<Exercise[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const reload = useCallback(() => setUserSongs(loadUserSongs()), []);
    useEffect(reload, [reload]);

    const userIds = new Set(userSongs.map((song) => song.id));
    const all = [...exercises, ...userSongs];

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
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Exercises</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Pick an exercise, then choose a mode. Connect a MIDI piano or play with your
                    computer keyboard.
                </p>
            </header>

            <Link
                to="/path"
                className="block rounded-md border border-indigo-300 bg-indigo-100 p-4 hover:bg-indigo-200 dark:border-indigo-800 dark:bg-indigo-900 dark:hover:bg-indigo-800"
            >
                <span className="font-medium text-indigo-800 dark:text-indigo-200">
                    🎯 Follow the learning path →
                </span>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    New here? Work through the exercises in a guided order.
                </p>
            </Link>

            <div className="grid gap-3 sm:grid-cols-3">
                <Link
                    to="/sprint"
                    className="block rounded-md border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:hover:bg-indigo-900"
                >
                    <span className="font-medium text-indigo-700 dark:text-indigo-300">
                        Sight-reading sprint →
                    </span>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Fresh notes every run — play as many as you can before the timer runs out.
                    </p>
                </Link>
                <Link
                    to="/daily"
                    className="block rounded-md border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:hover:bg-indigo-900"
                >
                    <span className="font-medium text-indigo-700 dark:text-indigo-300">
                        Daily challenge →
                    </span>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        One minute, the same notes for everyone today. Beat your best.
                    </p>
                </Link>
                <Link
                    to="/ear"
                    className="block rounded-md border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:hover:bg-indigo-900"
                >
                    <span className="font-medium text-indigo-700 dark:text-indigo-300">
                        Ear training →
                    </span>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Hear a note and find it by ear. No reading required.
                    </p>
                </Link>
            </div>

            <ul className="space-y-3">
                {all.map((exercise) => (
                    <li
                        key={exercise.id}
                        className="rounded-md border border-gray-200 dark:border-gray-800 p-4"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="text-lg font-medium">{exercise.title}</h2>
                            <span className="font-mono text-xs text-gray-400">
                                {exercise.tempo} bpm
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
                                    className="rounded-md bg-indigo-50 dark:bg-indigo-950 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
                                >
                                    {mode.label}
                                </Link>
                            ))}
                            <button
                                type="button"
                                onClick={() => share(exercise)}
                                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 underline"
                            >
                                {copiedId === exercise.id ? "Link copied!" : "Share"}
                            </button>
                            <button
                                type="button"
                                onClick={() => downloadAbc(exercise)}
                                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 underline"
                            >
                                Export
                            </button>
                            {userIds.has(exercise.id) && (
                                <button
                                    type="button"
                                    onClick={() => remove(exercise.id)}
                                    className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 underline"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            <SongImport existingIds={all.map((exercise) => exercise.id)} onAdded={reload} />
        </main>
    );
}
