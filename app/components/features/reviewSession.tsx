// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { earItemById } from "../../../core/earCatalog";
import type { ItemKind } from "../../../core/practisable";
import { useScore } from "../../hooks/useScore";
import { Button } from "../ui/button";
import { linkClasses } from "../ui/classes";
import { dueReviews, loadGradedMastery } from "../../lib/gradeProgress";
import { setBacklog } from "../../../core/mastery";
import { usePrefsStore, useServices } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { EarSession } from "./earSession";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { ScoreViewer } from "./scoreViewer";

const BACK = `text-sm ${linkClasses}`;

// A guided pass through the pieces that are fading: play each, then move on, with a
// shelve for anything you're not working on right now. The queue is snapshotted on
// mount so it stays stable even as playing a piece pushes its next-review date out
// and removes it from the live due set.
type Due = { id: string; title: string; kind: ItemKind };

export function ReviewSession() {
    const prefsStore = usePrefsStore();
    const services = useServices();
    const [queue, setQueue] = useState<Due[] | null>(null);
    const [index, setIndex] = useState(0);
    const [refreshed, setRefreshed] = useState(0);
    const [shelved, setShelved] = useState(0);
    // Whether the item on screen has actually been practised this session — only then
    // does moving on count it as refreshed, so the summary tells the truth and a
    // skipped item stays due rather than being silently marked done.
    const [playedCurrent, setPlayedCurrent] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadGradedMastery(services.mastery, services).then((items) => {
            if (!cancelled) {
                // The queue is snapshotted with each item's kind, so it drives the right
                // surface (a score, or an ear drill) even after practising one reschedules
                // it out of the live due set.
                const byId = new Map(items.map((item) => [item.id, item]));
                const due = dueReviews(items, Date.now(), prefsStore.load().reviewCap).flatMap(
                    (id) => {
                        const item = byId.get(id);
                        return item ? [{ id, title: item.title, kind: item.kind }] : [];
                    },
                );
                setQueue(due);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [prefsStore.load, services]);

    const current = queue?.[index];
    const resolved = useScore(current?.kind === "piece" ? current.id : "");
    // An unreachable piece renders like one still loading; the session's Skip
    // button already lets the player move past it.
    const score = resolved === "unavailable" ? undefined : resolved;

    // Hold the personal data until it's loaded, so nothing flashes during prerender.
    if (queue === null) {
        return null;
    }

    const total = queue.length;
    const done = index >= total;

    // Nothing due is the state a new player arrives in, so this doubles as the
    // feature's explainer: what a review session is, and somewhere to go next.
    // Landing here early should reward the curiosity, not dead-end it.
    if (total === 0) {
        return (
            <main className="mx-auto max-w-3xl space-y-4 p-6 font-sans">
                <h1 className="text-2xl font-semibold">{m.review_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.review_empty()}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.refresh_why()}</p>
                <div className="flex flex-wrap items-center gap-4">
                    <Link to="/library" className={BACK}>
                        {m.today_browse()}
                    </Link>
                    <Link to="/you" className={BACK}>
                        {m.review_back()}
                    </Link>
                </div>
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

    const advance = () => {
        setPlayedCurrent(false);
        setIndex((i) => i + 1);
    };
    const next = () => {
        // Playing the piece already rescheduled its review (via the viewer's run); only
        // count it as refreshed if it was actually played, otherwise this is a skip.
        if (playedCurrent) {
            setRefreshed((n) => n + 1);
        }
        advance();
    };
    const shelve = () => {
        if (current) {
            services.mastery.save(
                current.id,
                setBacklog(services.mastery.load(current.id), true, Date.now()),
            );
        }
        setShelved((n) => n + 1);
        advance();
    };

    // An ear item drives a drill instead of a score; its (exercise, level) come from the
    // id, and finishing its session records — and so reschedules — the review, just as a
    // played run does for a piece.
    const ear = current?.kind === "ear" ? earItemById(current.id) : undefined;

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

            {ear ? (
                <>
                    <h2 className="text-lg font-medium">{current?.title}</h2>
                    <EarSession
                        key={ear.id}
                        exercise={ear.exercise}
                        level={ear.level ?? 0}
                        autoStart={true}
                        onComplete={() => setPlayedCurrent(true)}
                    />
                </>
            ) : (
                score && (
                    <>
                        <h2 className="text-lg font-medium">{score.title}</h2>
                        <ScoreViewer
                            key={score.id}
                            id={score.id}
                            xml={score.xml}
                            title={score.title}
                            initialTempo={score.tempo}
                            beatsPerBar={score.beatsPerBar}
                            onRunComplete={() => setPlayedCurrent(true)}
                        />
                    </>
                )
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Button variant={playedCurrent ? "primary" : "secondary"} onClick={next}>
                    {playedCurrent ? m.review_next() : m.review_skip()}
                </Button>
                <Button variant="ghost" onClick={shelve}>
                    {m.review_shelve()}
                </Button>
                <Link to="/you" className={`${BACK} ml-auto`}>
                    {m.review_end()}
                </Link>
            </div>
        </main>
    );
}
