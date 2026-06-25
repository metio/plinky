// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ScoreViewer } from "../components/scoreViewer";
import { loadBundledScores, type Score } from "../lib/catalog";
import { dailyNumber, dailyScoreId, todayKey } from "../lib/daily";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/daily";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(
        "Daily challenge",
        "Today's piece — the same for everyone — graded and shareable",
    );
}

// Which day it is, and so which piece and number, depends on the viewer's clock —
// not the build's. Resolving it on mount (rather than during prerender) keeps the
// static HTML's date-independent <head> meta while avoiding a stale number baked
// at build time; the heading shows a placeholder until the real value arrives.
type Today = { number: number; score: Score | null };

export default function DailyRoute() {
    const [today, setToday] = useState<Today | null>(null);
    useEffect(() => {
        const dateKey = todayKey(new Date());
        const scores = loadBundledScores().sort((a, b) => a.id.localeCompare(b.id));
        const id = dailyScoreId(
            scores.map((entry) => entry.id),
            dateKey,
        );
        setToday({ number: dailyNumber(dateKey), score: scores.find((s) => s.id === id) ?? null });
    }, []);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">
                    {today ? `Plinky #${today.number}` : "Plinky #…"}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.daily_intro()}</p>
            </header>

            {today?.score && (
                <ScoreViewer
                    key={today.score.id}
                    id={today.score.id}
                    xml={today.score.xml}
                    title={today.score.title}
                    daily={today.number}
                />
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
