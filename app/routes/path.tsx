// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { exercises } from "../lib/exercises";
import { type PathStep, pathSteps } from "../lib/path";
import { loadBest, loadBestRhythm } from "../lib/scores";
import type { Route } from "./+types/path";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: "Plinky - Learning path" },
        { name: "description", content: "A guided order to work through the exercises" },
    ];
}

const STATUS_BADGE: Record<PathStep["status"], string> = {
    done: "✓",
    current: "▶",
    locked: "🔒",
};

export default function PathRoute() {
    const [steps, setSteps] = useState<PathStep[]>([]);
    useEffect(() => {
        setSteps(
            pathSteps(exercises, (id) => loadBest(id) !== null || loadBestRhythm(id) !== null),
        );
    }, []);

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Learning path</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Work through the exercises in order. Set a best score in Time trial or Rhythm to
                    mark one done and unlock the next.
                </p>
            </header>

            <ol className="space-y-3">
                {steps.map((step, index) => (
                    <li
                        key={step.exercise.id}
                        className={`flex gap-4 rounded-md border border-gray-200 p-4 dark:border-gray-800 ${
                            step.status === "locked" ? "opacity-50" : ""
                        }`}
                    >
                        <span className="font-mono text-lg text-gray-400">{index + 1}</span>
                        <div className="flex-1">
                            <h2 className="font-medium">
                                {STATUS_BADGE[step.status]} {step.exercise.title}
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {step.exercise.description}
                            </p>
                            {step.status === "locked" ? (
                                <span className="mt-2 inline-block text-sm text-gray-400">
                                    Finish the step above to unlock
                                </span>
                            ) : (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Link
                                        to={`/practice/${step.exercise.id}`}
                                        className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
                                    >
                                        Practice
                                    </Link>
                                    <Link
                                        to={`/time-trial/${step.exercise.id}`}
                                        className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
                                    >
                                        Time trial
                                    </Link>
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ol>

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                All exercises
            </Link>
        </main>
    );
}
