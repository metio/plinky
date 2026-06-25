// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ScoreViewer } from "../components/scoreViewer";
import { dailyNumber, dailyScoreId, todayKey } from "../lib/daily";
import { loadScores, type Score } from "../lib/scoreLibrary";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/daily";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(
        "Daily challenge",
        "Today's piece — the same for everyone — graded and shareable",
    );
}

export default function DailyRoute() {
    const dateKey = todayKey(new Date());
    const number = dailyNumber(dateKey);
    // Parsing the bundled MusicXML uses DOMParser, so load on the client only.
    const [score, setScore] = useState<Score | null>(null);
    useEffect(() => {
        const scores = loadScores();
        const id = dailyScoreId(
            scores.map((entry) => entry.id),
            dateKey,
        );
        setScore(scores.find((entry) => entry.id === id) ?? null);
    }, [dateKey]);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Plinky #{number}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.daily_intro()}</p>
            </header>

            {score && (
                <ScoreViewer
                    key={score.id}
                    id={score.id}
                    xml={score.xml}
                    title={score.title}
                    daily={number}
                />
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
