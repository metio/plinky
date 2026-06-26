// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { gradeOf } from "../lib/scoreDifficulty";
import { m } from "../paraglide/messages.js";

// The computed 1–8 grade of a score, as a small chip — so a learner can pick
// material at their level. Tinted by difficulty band (low / mid / high) for a
// quick visual read; the number carries the meaning.
const BAND = [
    "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
];

export function ScoreGrade({
    id,
    xml,
    className,
}: {
    id: string;
    xml: string;
    className?: string;
}) {
    const grade = gradeOf(id, xml);
    const band = BAND[grade <= 3 ? 0 : grade <= 5 ? 1 : 2];
    return (
        <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${band} ${className ?? ""}`}
        >
            {m.score_grade({ grade })}
        </span>
    );
}
