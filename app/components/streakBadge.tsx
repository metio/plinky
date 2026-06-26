// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { todayKey } from "../lib/daily";
import { currentStreak, loadHistory, PRACTICE_EVENT } from "../lib/history";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

// The practice streak shown beside the logo, Duolingo-style. The flame and number
// stay greyed until the day's first run, then light up. Streak data lives in
// localStorage, so it resolves after mount (nothing renders during prerender, so
// the server and first client render agree); it refreshes live on the practice
// event the run recorder fires.
export function StreakBadge() {
    const [streak, setStreak] = useState<number | null>(null);
    const [playedToday, setPlayedToday] = useState(false);

    useEffect(() => {
        const read = () => {
            const history = loadHistory();
            setStreak(currentStreak(history));
            setPlayedToday((history[todayKey(new Date())] ?? 0) > 0);
        };
        read();
        window.addEventListener(PRACTICE_EVENT, read);
        return () => window.removeEventListener(PRACTICE_EVENT, read);
    }, []);

    if (streak === null) {
        return null;
    }

    return (
        <Link
            to="/progress"
            aria-label={m.streak_label({ count: streak })}
            className={`flex items-center gap-1 text-sm font-semibold ${
                playedToday
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
            }`}
        >
            <span aria-hidden="true" className={playedToday ? "" : "grayscale"}>
                🔥
            </span>
            <span className="tabular-nums">{streak}</span>
        </Link>
    );
}
