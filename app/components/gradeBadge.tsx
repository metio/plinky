// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { currentGrade, loadGradedMastery } from "../lib/gradeProgress";
import { PRACTICE_EVENT } from "../lib/history";
import { loadPrefs } from "../lib/prefs";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

// The current grade beside the logo, Duolingo-crown style. Derived from how much of
// each grade's pool the player has mastered under their chosen decay mode, so it
// resolves after mount (nothing on the server, matching the first client render) and
// refreshes on the practice event. A crossed-swords mark flags competitive mode —
// the bragging badge for playing where grades can actually slip. Hidden until grade 1.
export function GradeBadge() {
    const [level, setLevel] = useState<number | null>(null);
    const [competitive, setCompetitive] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const read = () => {
            loadGradedMastery().then((items) => {
                if (!cancelled) {
                    const mode = loadPrefs().decayMode;
                    setLevel(currentGrade(items, mode, Date.now()));
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

    if (!level) {
        return null;
    }

    return (
        <Link
            to="/grades"
            aria-label={
                competitive ? m.grade_label_competitive({ level }) : m.grade_label({ level })
            }
            className="flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300"
        >
            <span aria-hidden="true">🎓</span>
            <span className="tabular-nums">{level}</span>
            {competitive && <span aria-hidden="true">⚔️</span>}
        </Link>
    );
}
