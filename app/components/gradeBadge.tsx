// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { currentGrade, loadGradedMastery, skillRating } from "../lib/gradeProgress";
import { PRACTICE_EVENT } from "../lib/history";
import { loadPrefs } from "../lib/prefs";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

// The current grade beside the logo, Duolingo-crown style, and the way to reach the
// grades page. Derived from how much of each grade's pool the player has mastered
// under their chosen decay mode, so it resolves after mount (nothing during prerender,
// matching the first client render) and refreshes on the practice event. It shows a
// muted Grade 0 before the first grade is earned — never empty, since it is one of the
// header's links to /you. The skill rating always rides alongside (0 for a fresh
// device), and a crossed-swords mark flags competitive mode.
export function GradeBadge() {
    const [level, setLevel] = useState<number | null>(null);
    const [skill, setSkill] = useState(0);
    const [competitive, setCompetitive] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const read = () => {
            loadGradedMastery().then((items) => {
                if (!cancelled) {
                    const mode = loadPrefs().decayMode;
                    const now = Date.now();
                    setLevel(currentGrade(items, mode, now));
                    setSkill(skillRating(items, mode, now));
                    setCompetitive(mode === "competitive");
                }
            });
        };
        read();
        window.addEventListener(PRACTICE_EVENT, read);
        return () => {
            cancelled = true;
            window.removeEventListener(PRACTICE_EVENT, read);
        };
    }, []);

    // Only the pre-mount state is empty; once read, Grade 0 still shows.
    if (level === null) {
        return null;
    }

    const earned = level > 0;
    return (
        <Link
            to="/you"
            aria-label={
                competitive ? m.grade_label_competitive({ level }) : m.grade_label({ level })
            }
            className={`flex items-center gap-1 text-sm font-semibold ${
                earned ? "text-indigo-600 dark:text-indigo-300" : "text-gray-500 dark:text-gray-400"
            }`}
        >
            <span aria-hidden="true" className={earned ? "" : "grayscale"}>
                🎓
            </span>
            <span className="tabular-nums">{level}</span>
            {competitive && <span aria-hidden="true">⚔️</span>}
            <span
                aria-hidden="true"
                className="ml-0.5 text-xs font-medium text-gray-500 dark:text-gray-400"
            >
                ⚡{skill}
            </span>
        </Link>
    );
}
