// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { Drawer } from "../ui/drawer";
import { FullScreen, Show } from "./conditional";
import { KeepUpResultCard } from "./keepUpResultCard";
import { LoopRangeBar } from "./loopRangeBar";
import { usePlaySession } from "./playSession";
import { PlayStage } from "./playStage";
import { PlayToolsDrawer } from "./playToolsDrawer";
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
        daily,
        ephemeral,
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
        runsOpen,
        setRunsOpen,
        takes,
        replayTake,
        deleteTake,
        saveCurrentTake,
    } = usePlaySession();

    return (
        <>
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

            {/* All play settings live in one drawer, opened by the Practice-tools
            button (at rest and in the full-screen transport) and portaled above the
            score — so the resting view stays uncluttered and the settings are reachable
            mid-play, not stranded in a fold that vanishes in full screen. */}
            <PlayToolsDrawer />

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
            {/* Your saved performances of this piece live in their own drawer — sharing
            your last run, replaying or racing an old one — so browsing them never
            clutters the resting play column. The drawer's count-titled header stands in
            for a section heading; replaying one closes the drawer so the score behind it
            is in view. Not for an ephemeral piece, which can't be saved. */}
            {!ephemeral && (
                <Drawer
                    open={runsOpen}
                    onClose={() => setRunsOpen(false)}
                    title={
                        takes.length > 0
                            ? m.takes_heading({ count: takes.length })
                            : m.takes_panel_heading()
                    }
                >
                    <TakesPanel
                        id={id}
                        takes={takes}
                        title={title}
                        activeReplayId={listenPlayback.activeReplayId}
                        playing={listenPlayback.playing}
                        lastRunOnsets={ghostRace.storedGhost}
                        canShareLastRun={!ghostRace.sharedFromLink}
                        onReplay={(take) => {
                            setRunsOpen(false);
                            replayTake(take);
                        }}
                        onStop={listenPlayback.stop}
                        onDelete={deleteTake}
                    />
                </Drawer>
            )}
        </>
    );
}
