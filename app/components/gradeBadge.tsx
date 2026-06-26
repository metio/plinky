// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { levelFor, measureProgress } from "../lib/gradeLadder";
import { PRACTICE_EVENT } from "../lib/history";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

// The current grade beside the logo, Duolingo-crown style. Derived from mastery
// and practice, so it resolves after mount (nothing on the server, matching the
// first client render) and refreshes on the practice event. Hidden until grade 1.
export function GradeBadge() {
    const [level, setLevel] = useState<number | null>(null);

    useEffect(() => {
        const read = () => setLevel(levelFor(measureProgress()));
        read();
        window.addEventListener(PRACTICE_EVENT, read);
        return () => window.removeEventListener(PRACTICE_EVENT, read);
    }, []);

    if (!level) {
        return null;
    }

    return (
        <Link
            to="/grades"
            aria-label={m.grade_label({ level })}
            className="flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300"
        >
            <span aria-hidden="true">🎓</span>
            <span className="tabular-nums">{level}</span>
        </Link>
    );
}
