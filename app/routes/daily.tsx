// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { DailyReveal } from "../components/features/dailyReveal";
import { ExportMenu } from "../components/features/exportMenu";
import { ScoreViewer } from "../components/features/scoreViewer";
import { RotateIcon } from "../components/ui/icons";
import { SegmentedControl } from "../components/ui/segmentedControl";
import { type DailyResult, dailyChallenge, dailyNumber, todayKey } from "../../core/daily";
import { useDailyStore } from "../contexts/services";
import { DEFAULT_DRILL, type DrillOptions, generateDrill } from "../../core/drill";
import { Disclosure } from "../components/ui/disclosure";
import { DrillSetup } from "../components/features/drillSetup";
import { routeMeta, webPageData } from "../../core/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/daily";
import { PageHeader } from "../components/ui/pageHeader";

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
    const [searchParams] = useSearchParams();
    const [today, setToday] = useState<Today | null>(null);
    // ?tab=warmup opens the warm-up directly — Today's warm-up offers a fresh drill,
    // and landing on the day's challenge instead would be a different thing entirely.
    const [mode, setMode] = useState<"challenge" | "warmup">(
        searchParams.get("tab") === "warmup" ? "warmup" : "challenge",
    );

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
    // A deep link lands on the tab with no press to generate its phrase, so the first
    // one is made here instead. Runs once: the guard clears as soon as it lands.
    useEffect(() => {
        if (mode === "warmup" && !warmupXml) {
            regenerate(drill);
        }
    });
    // Changing the shape of the drill regenerates it: the panel describes the piece
    // in front of you, so leaving the old one up would make every control read as
    // broken until the next press.
    const reshape = (next: DrillOptions) => {
        setDrill(next);
        regenerate(next);
    };

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader
                title={
                    today ? m.daily_title({ number: today.number }) : m.daily_title({ number: "…" })
                }
                hint={m.daily_intro()}
                // The same take-it-with-you actions a play page's title line carries:
                // print the phrase, or download it as MIDI/MusicXML.
                actions={
                    today ? <ExportMenu xml={today.xml} title={`Plinky #${today.number}`} /> : null
                }
            />

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
                    <DailyReveal alreadyOpen={today.result !== null}>
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
                    {/* The drill's shape, folded away. It is a panel of eleven controls,
                        and left open it stood between the button that makes a phrase and
                        the phrase itself — so a fresh drill appeared off screen and the
                        button read as broken. Above the score, like the run's own set-up
                        cards are below it: the thing you are reading stays the thing in
                        the middle. */}
                    <Disclosure summary={m.drill_setup()}>
                        <DrillSetup value={drill} onChange={reshape} />
                    </Disclosure>
                    {warmupXml && (
                        <ScoreViewer
                            key={run}
                            id="warmup"
                            xml={warmupXml}
                            title={m.daily_tab_warmup()}
                            beatsPerBar={drill.beatsPerBar}
                            ephemeral
                            // Beside the score it replaces, left of Practice so Listen
                            // keeps its place on its right. Ghost rather than filled: the
                            // warm-up's front door is still Practice, and two filled
                            // buttons side by side would leave a reader choosing between
                            // them rather than pressing one.
                            leadAction={
                                <Button variant="ghost" onClick={() => regenerate(drill)}>
                                    <RotateIcon />
                                    {m.drill_new()}
                                </Button>
                            }
                        />
                    )}
                </>
            )}
        </main>
    );
}
