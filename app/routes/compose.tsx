// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ComposeControls } from "../components/features/composeControls";
import { ComposeExportBar } from "../components/features/composeExportBar";
import { ComposeSettings } from "../components/features/composeSettings";
import { ComposeStage } from "../components/features/composeStage";
import { useOnboardingStore } from "../contexts/services";
import { useFullscreen } from "../hooks/useFullscreen";
import { useComposeFile } from "../hooks/useComposeFile";
import { useCompositionExport } from "../hooks/useCompositionExport";
import { useCompositionRecorder } from "../hooks/useCompositionRecorder";
import { useCompositionTransport } from "../hooks/useCompositionTransport";
import { useMetronome } from "../hooks/useMetronome";
import { useStaffSketch } from "../hooks/useStaffSketch";
import { type Composition, decodeComposition } from "../../core/composition";
import { followKeyboardWindow, type Span } from "../../core/keyboardWindow";
import { routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/compose";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.compose_heading(), m.meta_compose_description());
}

// The full 88-key piano (A0–C8): the range the windowed keyboard can slide across, so
// any note stays reachable in free play however far the player wanders from middle C.
const COMPOSE_REACH: Span = { from: 21, to: 108 };
// The on-screen keyboard shows a two-octave window that follows what the player
// improvises — compose has no piece to frame "whole", so a bounded follower
// keeps the keys a playable size wherever the music wanders.
const KEYBOARD_SPAN = 24;

export default function Compose() {
    const onboarding = useOnboardingStore();
    const [searchParams] = useSearchParams();
    const [title, setTitle] = useState("Improvisation");
    const [tempo, setTempo] = useState(120);
    const [beatsPerBar, setBeatsPerBar] = useState(4);
    const [quantizeOn, setQuantizeOn] = useState(true);
    const [metronomeOn, setMetronomeOn] = useState(false);

    const [keyWindow, setKeyWindow] = useState<Span>(() =>
        followKeyboardWindow(null, 60, KEYBOARD_SPAN, COMPOSE_REACH),
    );

    const recorder = useCompositionRecorder({
        // The first recorded note means the player has tried composing.
        onFirstNote: () => onboarding.markDiscovered("composed"),
        // Slide the on-screen keyboard to keep what's being played in view.
        onPitch: (note) =>
            setKeyWindow((prev) => followKeyboardWindow(prev, note, KEYBOARD_SPAN, COMPOSE_REACH)),
    });
    const { notes } = recorder;

    const transport = useCompositionTransport({
        notes,
        tempo,
        beatsPerBar,
        // The count-in's downbeat anchors the recording clock and leaves the
        // metronome running, so what's played next sits on the grid.
        onDownbeat: (now) => {
            recorder.anchorAt(now);
            setMetronomeOn(true);
        },
    });

    // Click through the count-in and, once armed, through the take, so the player stays
    // in time and the captured onsets line up with the grid the staff is drawn on.
    useMetronome(metronomeOn || transport.countingIn, tempo, beatsPerBar);

    // A shared composition arrives as ?c=<code>; load it once so it can be viewed,
    // played, extended, re-exported and re-shared.
    useEffect(() => {
        const code = searchParams.get("c");
        if (!code) {
            return;
        }
        const loaded = decodeComposition(code);
        if (loaded) {
            recorder.load(loaded.notes);
            setTempo(loaded.tempo);
            setBeatsPerBar(loaded.beatsPerBar);
        }
        // Only the initial code matters; later edits should not reload over the work.
    }, [searchParams, recorder.load]);

    const composition: Composition = useMemo(
        () => ({ notes: [...notes], tempo, beatsPerBar }),
        [notes, tempo, beatsPerBar],
    );

    const staffXml = useStaffSketch(composition, title, quantizeOn);
    const exporter = useCompositionExport(composition, title);

    // Swap the canvas over to a loaded composition.
    const applyLoaded = useCallback(
        (loaded: Composition) => {
            transport.stop();
            recorder.load(loaded.notes);
            setTempo(loaded.tempo);
            setBeatsPerBar(loaded.beatsPerBar);
        },
        [transport.stop, recorder.load],
    );

    const files = useComposeFile({
        hasWork: () => notes.length > 0,
        onLoad: applyLoaded,
    });

    const empty = notes.length === 0;

    // Count in is compose's Practice: it drops into full screen, where the
    // on-screen keys live; the stage's ✕ (or Esc) steps back out.
    const stageRef = useRef<HTMLElement>(null);
    const { fullscreen, enter: enterFullscreen, exit: exitFullscreen } = useFullscreen(stageRef);
    // Stepping out of full screen stops playback, any armed count-in and the
    // recording metronome, the way leaving the play surface ends a run — but only
    // on the transition, so playing the take back at rest is untouched.
    const wasFullscreen = useRef(false);
    useEffect(() => {
        if (wasFullscreen.current && !fullscreen) {
            transport.stop();
            setMetronomeOn(false);
        }
        wasFullscreen.current = fullscreen;
    }, [fullscreen, transport.stop]);

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <header className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">{m.compose_heading()}</h1>
                    {/* Capture is always on, so a live indicator makes that legible —
                        otherwise a first-timer can't tell their playing is being kept. */}
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70 motion-reduce:hidden" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        </span>
                        {empty
                            ? m.compose_recording_idle()
                            : m.compose_recording_count({ count: notes.length })}
                    </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.compose_intro()}</p>
            </header>

            {/* Controls, sketch and keys live together in the stage so full screen
                carries the whole recording loop with it. */}
            <ComposeStage
                staffXml={staffXml}
                keyWindow={keyWindow}
                stageRef={stageRef}
                fullscreen={fullscreen}
                onExitFullscreen={exitFullscreen}
                controls={
                    <ComposeControls
                        empty={empty}
                        playing={transport.playing}
                        countingIn={transport.countingIn}
                        checkpoint={recorder.checkpoint}
                        onCountIn={() => {
                            enterFullscreen();
                            transport.countIn();
                        }}
                        onPlay={transport.play}
                        onStop={transport.stop}
                        onSetCheckpoint={recorder.setCheckpointNow}
                        onResetToCheckpoint={() => {
                            transport.stop();
                            recorder.resetToCheckpoint();
                        }}
                        onClear={() => {
                            transport.stop();
                            recorder.clear();
                        }}
                    />
                }
            />

            <ComposeSettings
                title={title}
                onTitle={setTitle}
                tempo={tempo}
                onTempo={setTempo}
                beatsPerBar={beatsPerBar}
                onBeatsPerBar={setBeatsPerBar}
                quantizeOn={quantizeOn}
                onQuantize={setQuantizeOn}
                metronomeOn={metronomeOn}
                onMetronome={setMetronomeOn}
            />

            <ComposeExportBar
                empty={empty}
                noteCount={notes.length}
                copied={exporter.copied}
                onShare={exporter.share}
                onDownloadMidi={exporter.downloadMidi}
                onDownloadMusicXml={exporter.downloadMusicXml}
                onOpenFile={(file) => void files.openFile(file)}
                uploadError={files.error}
                pendingReplace={files.pendingReplace}
                onConfirmReplace={files.confirmReplace}
                onCancelReplace={files.cancelReplace}
            />
        </main>
    );
}
