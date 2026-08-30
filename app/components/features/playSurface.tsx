// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { m } from "../../paraglide/messages.js";
import { FullScreen, Show } from "./conditional";
import { KeepUpResultCard } from "./keepUpResultCard";
import { LoopRangeBar } from "./loopRangeBar";
import { usePlayPiece, usePlayShell, usePlaySetup, usePlayRun } from "./playSession";
import { PlayStage } from "./playStage";
import { PlayTransport } from "./playTransport";
import { WarmUpCard } from "./warmUpCard";
import { RaceVerdict } from "./raceVerdict";
import { RunResult } from "./runResult";
import { RunShare } from "./runShare";
import { SectionBest } from "./sectionBest";
import { ScoreCanvas } from "./scoreCanvas";
import { TakesPanel } from "./takesPanel";
import { RunSetup } from "./runSetup";

// The play surface: everything inside the full-screen shell, arranged from siblings that
// each read the shared play session. It owns no state — the transport bar, the score, the
// settings drawer and the practice stage react to one source of truth. What stays here is
// the layout and the finished-run readouts (the loop bar, the keep-up card, the grade panel
// and the runs drawer), which are small and site-specific to this arrangement.
export function PlaySurface() {
    const { assessment, credit, daily, ephemeral, id, license, measureCount, ready, title, xml } =
        usePlayPiece();
    const { fullscreen, gradePanelRef, runsView, showScore } = usePlayShell();
    const { hand } = usePlaySetup();
    const {
        deleteTake,
        ghostRace,
        keepUp,
        listenPlayback,
        loop,
        matcher,
        replayTake,
        runResult,
        runTempoScale,
        saveCurrentTake,
        takes,
    } = usePlayRun();

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
                        license={license}
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

                {/* Before the set-up cards, because it is the thing to do before playing
                    rather than a way of playing: the scale this piece is built from, so the
                    black keys it will ask for are under the hand before the reading starts.
                    Silent in full screen, where a run is already under way. */}
                <FullScreen off>
                    <WarmUpCard />
                </FullScreen>

                {/* Under the music: how you play this piece, and the challenges you can
                    put on it. They used to be one fold called "Set up your run" — two for
                    a beginner — so nothing on the page named a single one of them. */}
                {/* An assessment supplies its own preferences — the aids it measures the
                    absence of — so there is nothing here to set. Rendering the panel with
                    every control inert would be worse than leaving it out: a switch that
                    does nothing reads as a bug. */}
                {!assessment && (
                    <FullScreen off>
                        <RunSetup />
                    </FullScreen>
                )}

                <FullScreen off>
                    <Show when={ghostRace.sharedFromLink}>
                        <p className="text-sm text-muted">{m.ghost_shared_loaded()}</p>
                    </Show>
                </FullScreen>

                <PlayStage />

                {/* The play-along result — how many beats you kept up with — shown when a
            tempo-locked run finishes, in place of the self-paced grade panel. */}
                <FullScreen off>
                    {keepUp.result && <KeepUpResultCard result={keepUp.result} />}
                </FullScreen>
                {/* The head-to-head duel result, when this run chased a ghost — shown with
            the grade as the finish of that race. */}
                <FullScreen off>
                    {ghostRace.verdict && <RaceVerdict verdict={ghostRace.verdict} />}
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
                                tempoCurve={runResult.tempoCurve}
                                tempoScale={runTempoScale}
                                ephemeral={ephemeral}
                                runSaved={runResult.saved}
                                progressSaved={runResult.progressSaved}
                                onSaveTake={saveCurrentTake}
                            />
                            {/* Only for a real piece: a generated phrase is different
                            every time, so there is no "this piece's sections" to hold
                            a record for. */}
                            {!ephemeral && (
                                <SectionBest
                                    scoreId={id}
                                    notes={runResult.notes}
                                    tolerance={runResult.tolerance}
                                    tempoScale={runTempoScale}
                                />
                            )}
                            {/* At the very foot: the readouts above are what the player came
                            for, and showing somebody else is what you do after reading
                            them. */}
                            {runResult.grid && (
                                <RunShare
                                    grid={runResult.grid}
                                    notes={runResult.notes}
                                    letter={runResult.grade.letter}
                                    title={title}
                                    daily={daily}
                                />
                            )}
                        </div>
                    )}
                </FullScreen>
            </div>
        </>
    );
}
