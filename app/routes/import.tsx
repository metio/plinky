// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { LocalizedLink as Link } from "../components/localizedLink";
import { submissionUrl } from "../lib/catalog";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/import";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Find scores", "Add your own MusicXML, or submit a score to the catalog");
}

export default function ImportRoute() {
    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.import_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.import_intro()}</p>
            </header>

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
