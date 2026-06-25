// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ScoreViewer } from "../components/scoreViewer";
import { dailyChallenge, dailyNumber, todayKey } from "../lib/daily";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/daily";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(
        "Daily challenge",
        "Today's piece — the same for everyone — graded and shareable",
    );
}

// Which day it is, and so which phrase, number and tempo, depends on the viewer's
// clock — not the build's. Resolving it on mount (rather than during prerender)
// keeps the static HTML's date-independent <head> meta while avoiding a stale
// number baked at build time; the heading shows a placeholder until it arrives.
type Today = { number: number; tempo: number; xml: string };

export default function DailyRoute() {
    const [today, setToday] = useState<Today | null>(null);
    useEffect(() => {
        const dateKey = todayKey(new Date());
        const number = dailyNumber(dateKey);
        const { tempo, xml } = dailyChallenge(dateKey, number);
        setToday({ number, tempo, xml });
    }, []);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">
                    {today ? `Plinky #${today.number}` : "Plinky #…"}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.daily_intro()}</p>
            </header>

            {today && (
                <ScoreViewer
                    key={today.number}
                    id={`daily-${today.number}`}
                    xml={today.xml}
                    title={`Plinky #${today.number}`}
                    daily={today.number}
                    initialTempo={today.tempo}
                    lockTempo
                    ephemeral
                />
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
