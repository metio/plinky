// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { useScore } from "../hooks/useScore";
import { dueReviews, loadGradedMastery } from "../lib/gradeProgress";
import { loadMastery, saveMastery, setBacklog } from "../lib/mastery";
import { loadPrefs } from "../lib/prefs";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";
import { ScoreViewer } from "./scoreViewer";

const BACK = "text-sm text-indigo-700 underline dark:text-indigo-300";

// A guided pass through the pieces that are fading: play each, then move on, with a
// shelve for anything you're not working on right now. The queue is snapshotted on
// mount so it stays stable even as playing a piece pushes its next-review date out
// and removes it from the live due set.
export function ReviewSession() {
    const [queue, setQueue] = useState<string[] | null>(null);
    const [index, setIndex] = useState(0);
    const [refreshed, setRefreshed] = useState(0);
    const [shelved, setShelved] = useState(0);

    useEffect(() => {
        let cancelled = false;
        loadGradedMastery().then((items) => {
            if (!cancelled) {
                setQueue(dueReviews(items, Date.now(), loadPrefs().reviewCap));
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const current = queue?.[index];
    const score = useScore(current ?? "");

    // Hold the personal data until it's loaded, so nothing flashes during prerender.
    if (queue === null) {
        return null;
    }

    const total = queue.length;
    const done = index >= total;

    if (total === 0) {
        return (
            <main className="mx-auto max-w-3xl space-y-4 p-6 font-sans">
                <h1 className="text-2xl font-semibold">{m.review_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.review_empty()}</p>
                <Link to="/you" className={BACK}>
                    {m.review_back()}
                </Link>
            </main>
        );
    }

    if (done) {
        return (
            <main className="mx-auto max-w-3xl space-y-4 p-6 font-sans">
                <h1 className="text-2xl font-semibold">🎉 {m.review_complete_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {m.review_complete_summary({ refreshed, shelved })}
                </p>
                <Link to="/you" className={BACK}>
                    {m.review_back()}
                </Link>
            </main>
        );
    }

    const next = () => {
        setRefreshed((n) => n + 1);
        setIndex((i) => i + 1);
    };
    const shelve = () => {
        if (current) {
            saveMastery(current, setBacklog(loadMastery(current), true, Date.now()));
        }
        setShelved((n) => n + 1);
        setIndex((i) => i + 1);
    };

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h1 className="text-2xl font-semibold">{m.review_heading()}</h1>
                    <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                        {m.review_progress({ index: index + 1, total })}
                    </span>
                </div>
                {/* A simple filled bar so the end of the session is always in sight. */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.round((index / total) * 100)}%` }}
                    />
                </div>
            </header>

            {score && (
                <>
                    <h2 className="text-lg font-medium">{score.title}</h2>
                    <ScoreViewer
                        key={score.id}
                        id={score.id}
                        xml={score.xml}
                        title={score.title}
                        initialTempo={score.tempo}
                        beatsPerBar={score.beatsPerBar}
                    />
                </>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={next}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                    {m.review_next()}
                </button>
                <button
                    type="button"
                    onClick={shelve}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                    {m.review_shelve()}
                </button>
                <Link to="/you" className={`${BACK} ml-auto`}>
                    {m.review_end()}
                </Link>
            </div>
        </main>
    );
}
