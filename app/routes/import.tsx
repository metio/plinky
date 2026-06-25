// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { Link } from "react-router";
import { routeMeta } from "../lib/site";
import { submissionUrl } from "../lib/songs";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/import";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Find songs", "Find Plinky songs to import, or submit your own to the catalog");
}

// External pages that host Plinky songs. The catalog lives outside the app so it
// can grow without bloating it.
const SONG_SOURCES = [
    {
        name: m.import_source_wiki_name,
        url: "https://github.com/metio/plinky/wiki",
        blurb: m.import_source_wiki_blurb,
    },
];

export default function ImportRoute() {
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
