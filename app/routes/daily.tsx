// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { LocalizedLink as Link } from "../components/localizedLink";
import { ScoreViewer } from "../components/scoreViewer";
import { dailyChallenge, dailyNumber, todayKey } from "../lib/daily";
import { currentDailyStreak } from "../lib/dailyStreak";
import { generatePhrase } from "../lib/generator";
import { PRACTICE_EVENT } from "../lib/history";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/daily";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.meta_daily_title(), m.meta_daily_description());
}

// Which day it is — and so which phrase, number and tempo — depends on the
// viewer's clock, not the build's. Resolved on mount so the static HTML's
// date-independent <head> meta stays valid and no stale number is baked in.
type Today = { number: number; tempo: number; xml: string };

const WARMUP = { bars: 8, beatsPerBar: 4 };
const TAB = "rounded-md px-3 py-1.5 text-sm font-medium";
const TAB_ON = `${TAB} bg-indigo-600 text-white`;
const TAB_OFF = `${TAB} border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300`;

export default function DailyRoute() {
    const [today, setToday] = useState<Today | null>(null);
    const [streak, setStreak] = useState(0);
    const [mode, setMode] = useState<"challenge" | "warmup">("challenge");

    // Warm-up (the old sprint): a fresh generated phrase each run; bumping the
    // counter regenerates and remounts the viewer.
    const [run, setRun] = useState(0);
    const [warmupXml, setWarmupXml] = useState<string | null>(null);
    const [twoHands, setTwoHands] = useState(false);

    useEffect(() => {
        const dateKey = todayKey(new Date());
        const number = dailyNumber(dateKey);
        const { tempo, xml } = dailyChallenge(dateKey, number);
        setToday({ number, tempo, xml });
        // The streak refreshes when a run finishes (PRACTICE_EVENT) so completing
        // today's challenge bumps the count without a reload.
        const read = () => setStreak(currentDailyStreak(number));
        read();
        window.addEventListener(PRACTICE_EVENT, read);
        return () => window.removeEventListener(PRACTICE_EVENT, read);
    }, []);

    const regenerate = (hands: boolean) => {
        setWarmupXml(generatePhrase({ ...WARMUP, twoHands: hands }));
        setRun((value) => value + 1);
    };
    // Generate the first warm-up phrase only when the player opens that tab.
    const openWarmup = () => {
        setMode("warmup");
        if (!warmupXml) {
            regenerate(twoHands);
        }
    };
    const toggleHands = () => {
        const next = !twoHands;
        setTwoHands(next);
        regenerate(next);
    };

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">
                    {today ? `🎹 Plinky #${today.number}` : "🎹 Plinky #…"}
                </h1>
                {streak > 0 && (
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        {m.daily_streak({ count: streak })}
                    </p>
                )}
            </header>

            <fieldset aria-label={m.daily_mode_label()} className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setMode("challenge")}
                    aria-pressed={mode === "challenge"}
                    className={mode === "challenge" ? TAB_ON : TAB_OFF}
                >
                    {m.daily_tab_challenge()}
                </button>
                <button
                    type="button"
                    onClick={openWarmup}
                    aria-pressed={mode === "warmup"}
                    className={mode === "warmup" ? TAB_ON : TAB_OFF}
                >
                    {m.daily_tab_warmup()}
                </button>
            </fieldset>

            {mode === "challenge" ? (
                <>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{m.daily_intro()}</p>
                    {today && (
                        <ScoreViewer
                            key={today.number}
                            id={`daily-${today.number}`}
                            xml={today.xml}
                            title={`Plinky #${today.number}`}
                            daily={today.number}
                            initialTempo={today.tempo}
                            lockTempo
                            ephemeral
                        />
                    )}
                </>
            ) : (
                <>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{m.sprint_intro()}</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => regenerate(twoHands)}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                        >
                            {m.sprint_fresh()}
                        </button>
                        <button
                            type="button"
                            onClick={toggleHands}
                            aria-pressed={twoHands}
                            className={
                                twoHands
                                    ? "rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                                    : "rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                            }
                        >
                            {m.sprint_two_hands()}
                        </button>
                    </div>
                    {warmupXml && (
                        <ScoreViewer
                            key={run}
                            id="warmup"
                            xml={warmupXml}
                            title={m.daily_tab_warmup()}
                            beatsPerBar={WARMUP.beatsPerBar}
                            ephemeral
                        />
                    )}
                </>
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}
