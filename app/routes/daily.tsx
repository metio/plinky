// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { DailyReveal } from "../components/features/dailyReveal";
import { ExportMenu } from "../components/features/exportMenu";
import { ScoreViewer } from "../components/features/scoreViewer";
import { SegmentedControl } from "../components/ui/segmentedControl";
import { type DailyResult, dailyChallenge, dailyNumber, todayKey } from "../../core/daily";
import { useAnalytics, useDailyStore } from "../contexts/services";
import { DEFAULT_DRILL, type DrillOptions, generateDrill } from "../../core/drill";
import { DrillSetup } from "../components/features/drillSetup";
import { routeMeta, webPageData } from "../../core/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/daily";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.meta_daily_title(), m.meta_daily_description()),
        {
            "script:ld+json": webPageData(
                m.meta_daily_title(),
                m.meta_daily_description(),
                getLocale(),
                "/daily/",
            ),
        },
    ];
}

// Which day it is — and so which phrase, number and tempo — depends on the
// viewer's clock, not the build's. Resolved on mount so the static HTML's
// date-independent <head> meta stays valid and no stale number is baked in.
type Today = { number: number; tempo: number; xml: string; result: DailyResult | null };

// The warm-up starts where the daily does — a beginner's five-finger read — and
// every control on the panel moves it from there.
const WARMUP: DrillOptions = { ...DEFAULT_DRILL, bars: 8, beatsPerBar: 4, low: 72, high: 79 };

export default function DailyRoute() {
    const daily = useDailyStore();
    const [today, setToday] = useState<Today | null>(null);
    const analytics = useAnalytics();
    const [mode, setMode] = useState<"challenge" | "warmup">("challenge");

    // Warm-up (the old sprint): a fresh generated phrase each run; bumping the
    // counter regenerates and remounts the viewer.
    const [run, setRun] = useState(0);
    const [warmupXml, setWarmupXml] = useState<string | null>(null);
    const [drill, setDrill] = useState<DrillOptions>(WARMUP);

    useEffect(() => {
        const dateKey = todayKey(new Date());
        const number = dailyNumber(dateKey);
        const { tempo, xml } = dailyChallenge(dateKey, number);
        setToday({ number, tempo, xml, result: daily.loadResult(number) });
    }, [daily]);

    const regenerate = (options: DrillOptions) => {
        // The warm-up is deliberately unseeded — a different phrase every run, unlike
        // the day's challenge, which every player must share.
        setWarmupXml(generateDrill(options, Math.random));
        setRun((value) => value + 1);
    };
    // Generate the first warm-up phrase only when the player opens that tab.
    const openWarmup = () => {
        setMode("warmup");
        if (!warmupXml) {
            regenerate(drill);
        }
    };
    // Changing the shape of the drill regenerates it: the panel describes the piece
    // in front of you, so leaving the old one up would make every control read as
    // broken until the next press.
    const reshape = (next: DrillOptions) => {
        setDrill(next);
        regenerate(next);
    };

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                    <h1 className="text-2xl font-semibold">
                        {today
                            ? m.daily_title({ number: today.number })
                            : m.daily_title({ number: "…" })}
                    </h1>
                    {/* The same take-it-with-you actions a play page's title line
                    carries: print the phrase, or download it as MIDI/MusicXML. */}
                    {today && (
                        <div className="flex shrink-0 items-center gap-1">
                            <ExportMenu xml={today.xml} title={`Plinky #${today.number}`} />
                        </div>
                    )}
                </div>
                <p className="text-sm text-muted">{m.daily_intro()}</p>
            </header>

            <SegmentedControl
                options={[
                    { id: "challenge", label: m.daily_tab_challenge() },
                    { id: "warmup", label: m.daily_tab_warmup() },
                ]}
                value={mode}
                onChange={(next) => (next === "warmup" ? openWarmup() : setMode("challenge"))}
                label={m.daily_mode_label()}
            />

            {mode === "challenge" ? (
                today && (
                    // The unplayed daily arrives as a present to open; a finished
                    // one shows its result without ceremony.
                    <DailyReveal
                        alreadyOpen={today.result !== null}
                        onOpen={() =>
                            analytics.track("daily_opened", {
                                day: today.number,
                                tempo: today.tempo,
                            })
                        }
                    >
                        <ScoreViewer
                            key={today.number}
                            id={`daily-${today.number}`}
                            xml={today.xml}
                            title={`Plinky #${today.number}`}
                            daily={today.number}
                            initialTempo={today.tempo}
                            lockTempo
                            ephemeral
                            seededResult={today.result}
                        />
                    </DailyReveal>
                )
            ) : (
                <>
                    <p className="text-sm text-muted">{m.sprint_intro()}</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="primary" onClick={() => regenerate(drill)}>
                            {m.drill_new()}
                        </Button>
                    </div>
                    <DrillSetup value={drill} onChange={reshape} />
                    {warmupXml && (
                        <ScoreViewer
                            key={run}
                            id="warmup"
                            xml={warmupXml}
                            title={m.daily_tab_warmup()}
                            beatsPerBar={drill.beatsPerBar}
                            ephemeral
                        />
                    )}
                </>
            )}
        </main>
    );
}
