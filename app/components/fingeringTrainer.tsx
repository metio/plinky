// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useState } from "react";
import { LocalizedLink as Link } from "../components/localizedLink";
import { generateDrill } from "../lib/fingeringDrill";
import { type FingeringResult, scoreFingering } from "../lib/fingeringScore";
import { GRADE_COLOR, type Letter } from "../lib/grade";
import { noteName } from "../lib/midi";
import { loadPrefs } from "../lib/prefs";
import { m } from "../paraglide/messages.js";

const FINGERS = [1, 2, 3, 4, 5];

// A self-paced grade for the fingering's smoothness, reusing the run grade's
// letters and colours so the feedback reads like the rest of the app.
function letterFor(efficiency: number): Letter {
    if (efficiency >= 0.97) return "S";
    if (efficiency >= 0.9) return "A";
    if (efficiency >= 0.8) return "B";
    if (efficiency >= 0.65) return "C";
    return "D";
}

// Reads a line and asks the player to choose a finger for every note, then scores
// the choice by playing effort against a comfortable fingering — building the
// skill of working fingerings out rather than leaning on the app's suggestions.
export function FingeringTrainer() {
    const [pitches, setPitches] = useState<number[]>([]);
    const [fingers, setFingers] = useState<(number | null)[]>([]);
    const [current, setCurrent] = useState(0);
    const [result, setResult] = useState<FingeringResult | null>(null);

    const fresh = useCallback(() => {
        const line = generateDrill();
        setPitches(line);
        setFingers(line.map(() => null));
        setCurrent(0);
        setResult(null);
    }, []);

    useEffect(() => {
        fresh();
    }, [fresh]);

    const assign = useCallback(
        (finger: number) => {
            if (result) {
                return;
            }
            setFingers((prev) => {
                const next = [...prev];
                next[current] = finger;
                return next;
            });
            setCurrent((index) => Math.min(index + 1, pitches.length - 1));
        },
        [current, pitches.length, result],
    );

    // Number keys 1–5 assign a finger to the highlighted note, like the buttons.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const finger = Number(event.key);
            if (finger >= 1 && finger <= 5) {
                assign(finger);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [assign]);

    const complete = fingers.length > 0 && fingers.every((finger) => finger !== null);
    const check = () => {
        if (complete) {
            const span = loadPrefs().handSpan.right ?? undefined;
            setResult(scoreFingering(pitches, fingers as number[], "right", span));
        }
    };

    const reconsider = new Set(result?.reconsider);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.fingering_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.fingering_intro()}</p>
            </header>

            {/* The line: a note per cell, with the chosen finger beneath it. */}
            <div className="flex flex-wrap gap-2">
                {pitches.map((pitch, index) => {
                    const chosen = fingers[index];
                    const flagged = reconsider.has(index);
                    const active = !result && index === current;
                    return (
                        <button
                            type="button"
                            // The line never reorders within a run, so the position is a stable key.
                            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length line, position is identity
                            key={index}
                            onClick={() => !result && setCurrent(index)}
                            aria-current={active ? "true" : undefined}
                            className={`flex w-14 flex-col items-center rounded-md border px-2 py-1 ${
                                flagged
                                    ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950"
                                    : active
                                      ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950"
                                      : "border-gray-200 dark:border-gray-800"
                            }`}
                        >
                            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                                {noteName(pitch)}
                            </span>
                            <span className="text-lg font-semibold tabular-nums">
                                {chosen ?? "·"}
                            </span>
                            {result && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {result.suggested[index]}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {result ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-4 rounded-md border border-gray-200 p-3 dark:border-gray-800">
                        <div
                            className={`text-5xl font-bold leading-none ${GRADE_COLOR[letterFor(result.efficiency)]}`}
                        >
                            {letterFor(result.efficiency)}
                        </div>
                        <div className="space-y-1 text-sm">
                            <p className="font-medium">
                                {m.fingering_smoothness({
                                    percent: Math.round(result.efficiency * 100),
                                })}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                                {result.reconsider.length === 0
                                    ? m.fingering_comfortable()
                                    : m.fingering_reconsider()}
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {m.fingering_legend()}
                    </p>
                    <button
                        type="button"
                        onClick={fresh}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                    >
                        {m.fingering_new()}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{m.fingering_hint()}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {FINGERS.map((finger) => (
                            <button
                                key={finger}
                                type="button"
                                onClick={() => assign(finger)}
                                aria-label={m.fingering_finger({ finger })}
                                className="h-10 w-10 rounded-md bg-indigo-50 text-lg font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                            >
                                {finger}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={check}
                            disabled={!complete}
                            className="ml-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                            {m.fingering_check()}
                        </button>
                    </div>
                </div>
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
