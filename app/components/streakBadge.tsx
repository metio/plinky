// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { todayKey } from "../lib/daily";
import { currentStreak, loadHistory, PRACTICE_EVENT } from "../lib/history";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

// How hot the streak runs: the flame's colour deepens as the streak passes the
// 7/30/100-day milestones, so a long streak visibly rewards itself. Colours clear
// the AA contrast bar on both themes.
function streakColor(streak: number): string {
    if (streak >= 100) {
        return "text-rose-700 dark:text-rose-400";
    }
    if (streak >= 30) {
        return "text-orange-700 dark:text-orange-400";
    }
    if (streak >= 7) {
        return "text-amber-700 dark:text-amber-400";
    }
    return "text-gray-900 dark:text-gray-100";
}

// The practice streak shown beside the logo, Duolingo-style, and the way to reach the
// progress page. The flame and number stay greyed until the day's first run, then
// light up — and warm through the milestones as the streak grows. Streak data lives
// in localStorage, so it resolves after mount (nothing during prerender, so server and
// first client render agree); it refreshes live on the practice event.
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
            to="/you"
            aria-label={m.streak_label({ count: streak })}
            className={`flex items-center gap-1 text-sm font-semibold transition-colors ${
                playedToday ? streakColor(streak) : "text-gray-500 dark:text-gray-400"
            }`}
        >
            <span aria-hidden="true" className={playedToday ? "" : "grayscale"}>
                🔥
            </span>
            <span className="tabular-nums">{streak}</span>
        </Link>
    );
}
