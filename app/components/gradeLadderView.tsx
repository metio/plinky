// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { type LadderProgress, levelFor, measureProgress, nextLevel } from "../lib/gradeLadder";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

const LABEL: Record<keyof LadderProgress, () => string> = {
    scales: m.grades_scales,
    arpeggios: m.grades_arpeggios,
    pieces: m.grades_pieces,
    days: m.grades_days,
};

// Shows the player's current grade and exactly what's left for the next one — the
// "reach the next grade" target. Reads progress from local mastery and history
// after mount.
export function GradeLadderView() {
    const [progress, setProgress] = useState<LadderProgress | null>(null);

    useEffect(() => {
        setProgress(measureProgress());
    }, []);

    const level = progress ? levelFor(progress) : 0;
    const next = progress ? nextLevel(progress) : null;

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.grades_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.grades_intro()}</p>
            </header>

            <div className="flex items-center gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-800">
                <span aria-hidden="true" className="text-4xl">
                    🎓
                </span>
                <span className="text-2xl font-bold">
                    {level === 0 ? m.grades_not_started() : m.grades_current({ level })}
                </span>
            </div>

            {progress &&
                (next ? (
                    <section className="space-y-2">
                        <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {m.grades_next({ level: next.level })}
                        </h2>
                        <ul className="space-y-1 text-sm">
                            {(Object.keys(next.requirement) as (keyof LadderProgress)[]).map(
                                (key) => {
                                    const need = next.requirement[key] ?? 0;
                                    const have = progress[key];
                                    const done = have >= need;
                                    return (
                                        <li
                                            key={key}
                                            className={
                                                done
                                                    ? "text-gray-500 dark:text-gray-400"
                                                    : "text-gray-800 dark:text-gray-200"
                                            }
                                        >
                                            {done ? "✓" : "•"} {LABEL[key]()}:{" "}
                                            <span className="font-mono tabular-nums">
                                                {Math.min(have, need)}/{need}
                                            </span>
                                        </li>
                                    );
                                },
                            )}
                        </ul>
                    </section>
                ) : (
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        {m.grades_top()}
                    </p>
                ))}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
