// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { LocalizedLink as Link } from "../components/localizedLink";
import { ShareCard } from "../components/shareCard";
import { loadCatalog } from "../lib/catalog";
import { loadHistory, type PracticeSummary, summarizePractice } from "../lib/history";
import { loadLifetime, progressGrid } from "../lib/lifetime";
import { isDue, loadAllMastery } from "../lib/mastery";
import type { Grid } from "../lib/shareCard";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/progress";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.progress_heading(), m.meta_progress_description());
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </div>
            <div className="font-mono text-3xl tabular-nums">{value}</div>
        </div>
    );
}

export default function ProgressRoute() {
    const [summary, setSummary] = useState<PracticeSummary | null>(null);
    const [fingerprint, setFingerprint] = useState<Grid | null>(null);
    const [due, setDue] = useState<{ id: string; title: string }[]>([]);
    useEffect(() => {
        setSummary(summarizePractice(loadHistory()));
        setFingerprint(progressGrid(loadLifetime()));
        // The review queue, resolved to catalogue titles so each entry links
        // straight to its practice page — the same isDue rule the library uses.
        const now = Date.now();
        const titles = new Map(loadCatalog().map((score) => [score.id, score.title]));
        setDue(
            loadAllMastery()
                .filter(({ id, mastery }) => titles.has(id) && isDue(mastery, now))
                .map(({ id }) => ({ id, title: titles.get(id) ?? id })),
        );
    }, []);

    if (!summary) {
        return null;
    }
    const max = Math.max(1, ...summary.recent.map((day) => day.notes));

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.progress_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.progress_intro()}</p>
            </header>

            <div className="grid grid-cols-3 gap-4">
                <Stat label={m.progress_day_streak()} value={`${summary.currentStreak} 🔥`} />
                <Stat label={m.progress_days_practiced()} value={String(summary.daysPracticed)} />
                <Stat label={m.progress_notes_played()} value={String(summary.totalNotes)} />
            </div>

            {due.length > 0 && (
                <section className="space-y-3">
                    <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {m.progress_due_heading()}
                    </h2>
                    <ul className="flex flex-wrap gap-2">
                        {due.map((score) => (
                            <li key={score.id}>
                                <Link
                                    to={`/play/${score.id}`}
                                    className="inline-block rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
                                >
                                    {score.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div>
                <h2 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {m.progress_last_7_days()}
                </h2>
                <div className="flex h-32 items-end gap-2">
                    {summary.recent.map((day) => (
                        <div
                            key={day.date}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                            title={
                                day.notes === 1
                                    ? m.progress_notes_one({ count: day.notes })
                                    : m.progress_notes_other({ count: day.notes })
                            }
                        >
                            <div
                                className="w-full rounded-t bg-indigo-500"
                                style={{ height: `${Math.round((day.notes / max) * 100)}%` }}
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {day.date.slice(5)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {fingerprint && (
                <ShareCard
                    grid={fingerprint}
                    caption={m.progress_share_caption()}
                    gridLabel={m.progress_grid_label()}
                    rowLabels={[m.scores_accuracy(), m.scores_timing(), m.scores_flow()]}
                    boast={m.progress_share_boast()}
                    heading={`Plinky ${summary.currentStreak}·${summary.daysPracticed}·${summary.totalNotes}`}
                />
            )}

            {summary.totalNotes === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.progress_empty()}</p>
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.progress_back()}
            </Link>
        </main>
    );
}
