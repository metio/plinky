// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { decodeSong } from "../lib/share";
import { routeMeta } from "../lib/site";
import { buildExercise, loadUserSongs, saveUserSong, submissionUrl } from "../lib/songs";
import { buildSteps } from "../lib/steps";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/import";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Find songs", "Import Plinky songs from a link or a shared song pack");
}

// External pages that host Plinky song links; each points back at /import#s=… so
// opening one adds the song to this device. The catalog lives outside the app so
// it can grow without bloating it.
const SONG_SOURCES = [
    {
        name: m.import_source_wiki_name,
        url: "https://github.com/metio/plinky/wiki",
        blurb: m.import_source_wiki_blurb,
    },
];

// abcjs is loaded on demand so opening a link does not pull it into the bundle
// until the song is validated.
async function isPlayable(abc: string): Promise<boolean> {
    const { default: abcjs } = await import("abcjs");
    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.visibility = "hidden";
    document.body.appendChild(element);
    try {
        const tune = abcjs.renderAbc(element, abc, { add_classes: true })[0];
        return !!tune && buildSteps(tune, 100).length > 0;
    } catch {
        return false;
    } finally {
        element.remove();
    }
}

type Outcome = { ok: true; id: string; title: string } | { ok: false; message: string };

export default function ImportRoute() {
    const [hasLink, setHasLink] = useState(false);
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    useEffect(() => {
        const encoded = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("s");
        if (!encoded) {
            return; // No shared song in the URL: show the directory below.
        }
        setHasLink(true);
        (async () => {
            const abc = decodeSong(encoded);
            if (!abc || !(await isPlayable(abc))) {
                setOutcome({ ok: false, message: m.import_invalid() });
                return;
            }
            const ids = loadUserSongs().map((song) => song.id);
            const exercise = buildExercise(abc, ids);
            saveUserSong(exercise);
            setOutcome({ ok: true, id: exercise.id, title: exercise.title });
        })();
    }, []);

    if (hasLink) {
        return (
            <main className="mx-auto max-w-3xl space-y-4 p-6 font-sans">
                <h1 className="text-2xl font-semibold">{m.import_shared_heading()}</h1>

                {outcome === null && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.import_reading_link()}
                    </p>
                )}

                {outcome?.ok === false && (
                    <div className="space-y-3">
                        <p className="text-sm text-red-600 dark:text-red-400">{outcome.message}</p>
                        <Link
                            to="/"
                            className="text-sm text-indigo-700 underline dark:text-indigo-300"
                        >
                            {m.action_back_home()}
                        </Link>
                    </div>
                )}

                {outcome?.ok === true && (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {m.import_added_prefix()}{" "}
                            <span className="font-medium">{outcome.title}</span>{" "}
                            {m.import_added_suffix()}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                to={`/practice/${outcome.id}`}
                                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                            >
                                {m.import_practice_it()}
                            </Link>
                            <Link
                                to="/"
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                            >
                                {m.import_home()}
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.import_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.import_intro()}</p>
            </header>

            <ul className="space-y-3">
                {SONG_SOURCES.map((source) => (
                    <li
                        key={source.url}
                        className="rounded-md border border-gray-200 p-4 dark:border-gray-800"
                    >
                        <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-indigo-700 underline dark:text-indigo-300"
                        >
                            {source.name()} →
                        </a>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {source.blurb()}
                        </p>
                    </li>
                ))}
            </ul>

            <p className="text-sm text-gray-500 dark:text-gray-400">
                {m.import_own_prefix()}{" "}
                <Link to="/" className="text-indigo-700 underline dark:text-indigo-300">
                    {m.import_own_home_link()}
                </Link>
                {m.import_own_middle()}{" "}
                <Link to="/settings" className="text-indigo-700 underline dark:text-indigo-300">
                    {m.import_own_settings_link()}
                </Link>
                {m.import_own_suffix()}
            </p>

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
        </main>
    );
}
