// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ScoreViewer } from "../components/scoreViewer";
import { loadScores, type Score } from "../lib/scoreLibrary";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/scores";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Scores", "Public-domain piano scores rendered and played in your browser");
}

export default function ScoresRoute() {
    // Parsing the bundled MusicXML uses DOMParser, so load on the client only.
    const [scores, setScores] = useState<Score[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        const loaded = loadScores();
        setScores(loaded);
        setSelectedId((current) => current ?? loaded[0]?.id ?? null);
    }, []);

    const selected = scores.find((score) => score.id === selectedId) ?? null;

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.scores_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.scores_intro()}</p>
            </header>

            {scores.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.scores_empty()}</p>
            ) : (
                <>
                    <ul className="flex flex-wrap gap-2">
                        {scores.map((score) => (
                            <li key={score.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(score.id)}
                                    aria-pressed={score.id === selectedId}
                                    className={`rounded-md border px-3 py-2 text-left text-sm ${
                                        score.id === selectedId
                                            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
                                            : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    <span className="block font-medium">{score.title}</span>
                                    {score.composer && (
                                        <span className="block text-xs text-gray-600 dark:text-gray-400">
                                            {score.composer}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>

                    {selected && (
                        <ScoreViewer key={selected.id} xml={selected.xml} title={selected.title} />
                    )}
                </>
            )}

            <Link to="/songs" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
