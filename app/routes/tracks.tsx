// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { LocalizedLink as Link } from "../components/localizedLink";
import { loadCatalog } from "../lib/catalog";
import { loadMastery } from "../lib/mastery";
import { routeMeta } from "../lib/site";
import { type Track, type TrackStep, TRACKS, trackSteps } from "../lib/tracks";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/tracks";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Tracks", "Ordered practice paths — graded progressions and timed routines");
}

// A distinct accent per parallel track, so the columns read as separate paths.
const ACCENTS = [
    {
        done: "bg-indigo-500 text-white",
        ring: "ring-indigo-300",
        line: "bg-indigo-200 dark:bg-indigo-900",
        label: "text-indigo-700 dark:text-indigo-300",
    },
    {
        done: "bg-emerald-500 text-white",
        ring: "ring-emerald-300",
        line: "bg-emerald-200 dark:bg-emerald-900",
        label: "text-emerald-700 dark:text-emerald-300",
    },
    {
        done: "bg-amber-500 text-white",
        ring: "ring-amber-300",
        line: "bg-amber-200 dark:bg-amber-900",
        label: "text-amber-700 dark:text-amber-300",
    },
    {
        done: "bg-rose-500 text-white",
        ring: "ring-rose-300",
        line: "bg-rose-200 dark:bg-rose-900",
        label: "text-rose-700 dark:text-rose-300",
    },
    {
        done: "bg-sky-500 text-white",
        ring: "ring-sky-300",
        line: "bg-sky-200 dark:bg-sky-900",
        label: "text-sky-700 dark:text-sky-300",
    },
    {
        done: "bg-violet-500 text-white",
        ring: "ring-violet-300",
        line: "bg-violet-200 dark:bg-violet-900",
        label: "text-violet-700 dark:text-violet-300",
    },
];

type Accent = (typeof ACCENTS)[number];

// The gentle left/right sway that gives the path its Duolingo-style wind.
const SWAY = [0, 36, 0, -36];

// A step is cleared once its piece has been learned.
function done(id: string): boolean {
    return loadMastery(id)?.learned === true;
}

function Node({ step, index, accent }: { step: TrackStep; index: number; accent: Accent }) {
    const base =
        "relative z-10 flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold shadow-md";
    if (step.status === "done") {
        return <div className={`${base} ${accent.done}`}>✓</div>;
    }
    if (step.status === "current") {
        return (
            <div
                className={`${base} ${accent.done} ring-4 ring-offset-2 ${accent.ring} ring-offset-white dark:ring-offset-gray-950`}
            >
                ▶
            </div>
        );
    }
    return (
        <div className={`${base} bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400`}>
            {index + 1}
        </div>
    );
}

function TrackPath({
    track,
    accent,
    titles,
}: {
    track: Track;
    accent: Accent;
    titles: Record<string, string>;
}) {
    const steps = trackSteps(track.scoreIds, done);
    const doneCount = steps.filter((step) => step.status === "done").length;

    return (
        <div className="flex flex-col">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className={`font-semibold ${accent.label}`}>{track.name}</h2>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {track.minutes ? m.tracks_minutes_prefix({ minutes: track.minutes }) : ""}
                    {doneCount}/{steps.length}
                </span>
            </div>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{track.description}</p>

            <div className="relative flex flex-col items-center gap-5 py-2">
                <div
                    className={`absolute top-4 bottom-4 left-1/2 w-1 -translate-x-1/2 rounded ${accent.line}`}
                />
                {steps.map((step, index) => {
                    const title = titles[step.scoreId];
                    const node = <Node step={step} index={index} accent={accent} />;
                    return (
                        <div
                            key={step.scoreId}
                            className="flex flex-col items-center gap-1"
                            style={{ transform: `translateX(${SWAY[index % SWAY.length]}px)` }}
                        >
                            {title ? (
                                <Link to={`/play/${step.scoreId}`} aria-label={title}>
                                    {node}
                                </Link>
                            ) : (
                                node
                            )}
                            <span
                                className={`max-w-32 text-center text-xs ${
                                    step.status === "current"
                                        ? `font-medium ${accent.label}`
                                        : "text-gray-500 dark:text-gray-400"
                                }`}
                            >
                                {title ?? step.scoreId}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function TracksRoute() {
    const [titles, setTitles] = useState<Record<string, string>>({});
    useEffect(() => {
        const byId: Record<string, string> = {};
        for (const score of loadCatalog()) {
            byId[score.id] = score.title;
        }
        setTitles(byId);
    }, []);

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.tracks_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.tracks_intro()}</p>
            </header>

            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {TRACKS.map((track, index) => (
                    <TrackPath
                        key={track.id}
                        track={track}
                        accent={ACCENTS[index % ACCENTS.length]!}
                        titles={titles}
                    />
                ))}
            </div>

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
