// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { FullScreen, Show } from "./conditional";
import { KeepUpResultCard } from "./keepUpResultCard";
import { LoopRangeBar } from "./loopRangeBar";
import { usePlaySession } from "./playSession";
import { PlayStage } from "./playStage";
import { PlayTransport } from "./playTransport";
import { RunResult } from "./runResult";
import { ScoreCanvas } from "./scoreCanvas";
import { TakesPanel } from "./takesPanel";

// The play surface: everything inside the full-screen shell, arranged from siblings that
// each read the shared play session. It owns no state — the transport bar, the score, the
// settings drawer and the practice stage react to one source of truth. What stays here is
// the layout and the finished-run readouts (the loop bar, the keep-up card, the grade panel
// and the runs drawer), which are small and site-specific to this arrangement.
export function PlaySurface() {
    const {
        id,
        title,
        credit,
        daily,
        ephemeral,
        fullscreen,
        ready,
        measureCount,
        matcher,
        keepUp,
        listenPlayback,
        ghostRace,
        loop,
        runResult,
        runTempoScale,
        gradePanelRef,
        runsView,
        showScore,
        takes,
        xml,
        hand,
        replayTake,
        deleteTake,
        saveCurrentTake,
    } = usePlaySession();

    return (
        <>
            {/* The Runs tab replaces the resting play column with the saved-runs page —
            the score below stays mounted (hidden, never unmounted) because replaying a
            take drives its cursor; replay hops back to the Play tab to watch it. */}
            {runsView && !ephemeral && (
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">
                        {takes.length > 0
                            ? m.takes_heading({ count: takes.length })
                            : m.takes_panel_heading()}
                    </h2>
                    <TakesPanel
                        id={id}
                        takes={takes}
                        title={title}
                        credit={credit}
                        activeReplayId={listenPlayback.activeReplayId}
                        playing={listenPlayback.playing}
                        original={{ xml, hand }}
                        onReplay={(take) => {
                            showScore();
                            replayTake(take);
                        }}
                        onStop={listenPlayback.stop}
                        onDelete={deleteTake}
                    />
                </section>
            )}
            {/* In full screen the column joins the shell's flex chain, so the score's
            flex-1 really stretches and reclaims whatever the keyboard isn't using. */}
            <div
                className={
                    runsView
                        ? "hidden"
                        : fullscreen
                          ? "flex min-h-0 flex-1 flex-col gap-2"
                          : "space-y-5"
                }
            >
                <PlayTransport />
                {/* When the loop is on, its range and narrowing controls sit right by the
            score — the drawer's backdrop covers the score, so narrowing happens here,
            drawer closed. Hidden during a run, when the score isn't yours to click. */}
                {ready && measureCount > 1 && loop.on && !matcher.practicing && !keepUp.running && (
                    <LoopRangeBar
                        measureCount={measureCount}
                        from={loop.from}
                        to={loop.to}
                        setFrom={loop.setFrom}
                        setTo={loop.setTo}
                        onWholeSong={loop.wholeSong}
                    />
                )}
                <ScoreCanvas />

                <FullScreen off>
                    <Show when={ghostRace.sharedFromLink}>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {m.ghost_shared_loaded()}
                        </p>
                    </Show>
                </FullScreen>

                <PlayStage />

                {/* The play-along result — how many beats you kept up with — shown when a
            tempo-locked run finishes, in place of the self-paced grade panel. */}
                <FullScreen off>
                    {keepUp.result && <KeepUpResultCard result={keepUp.result} />}
                </FullScreen>
                {/* The grade narrows the type for the readouts below, so it stays an `&&`
            guard; the full-screen branch is the declarative half. */}
                <FullScreen off>
                    {runResult.grade && (
                        <div ref={gradePanelRef} className="space-y-3">
                            <RunResult
                                grade={runResult.grade}
                                notes={runResult.notes}
                                tolerance={runResult.tolerance}
                                grid={runResult.grid}
                                tempoCurve={runResult.tempoCurve}
                                tempoScale={runTempoScale}
                                daily={daily}
                                title={title}
                                ephemeral={ephemeral}
                                runSaved={runResult.saved}
                                onSaveTake={saveCurrentTake}
                            />
                        </div>
                    )}
                </FullScreen>
            </div>
        </>
    );
}
