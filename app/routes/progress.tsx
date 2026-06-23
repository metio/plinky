// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { loadHistory, type PracticeSummary, summarizePractice } from "../lib/history";
import type { Route } from "./+types/progress";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: "Plinky - Progress" },
        { name: "description", content: "Your practice history and streak" },
    ];
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
            <div className="font-mono text-3xl tabular-nums">{value}</div>
        </div>
    );
}

export default function ProgressRoute() {
    const [summary, setSummary] = useState<PracticeSummary | null>(null);
    useEffect(() => {
        setSummary(summarizePractice(loadHistory()));
    }, []);

    if (!summary) {
        return null;
    }
    const max = Math.max(1, ...summary.recent.map((day) => day.notes));

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Progress</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Practice is tracked on this device — finish a run in any mode to add to it.
                </p>
            </header>

            <div className="grid grid-cols-3 gap-4">
                <Stat label="Day streak" value={`${summary.currentStreak} 🔥`} />
                <Stat label="Days practiced" value={String(summary.daysPracticed)} />
                <Stat label="Notes played" value={String(summary.totalNotes)} />
            </div>

            <div>
                <h2 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Last 7 days
                </h2>
                <div className="flex h-32 items-end gap-2">
                    {summary.recent.map((day) => (
                        <div
                            key={day.date}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                            title={`${day.notes} notes`}
                        >
                            <div
                                className="w-full rounded-t bg-indigo-500"
                                style={{ height: `${Math.round((day.notes / max) * 100)}%` }}
                            />
                            <span className="text-xs text-gray-400">{day.date.slice(5)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {summary.totalNotes === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    No practice logged yet — finish a run to start your streak.
                </p>
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                Back to exercises
            </Link>
        </main>
    );
}
