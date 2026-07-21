// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { tempoTerm } from "../../../core/tempoTerm";
import { m } from "../../paraglide/messages.js";
import { Bpm } from "../ui/bpm";
import { BumpValue } from "../ui/stepper";
import { ToggleIconButton } from "../ui/toggleIconButton";
import { Button, IconButton } from "../ui/button";
import { CloseIcon, FingersIcon, PlayIcon, RotateIcon, SpeakerIcon, StopIcon } from "../ui/icons";
import { FullScreen, Show } from "./conditional";
import { usePlaySession } from "./playSession";
import { RunSetup } from "./runSetup";

// The play controls. Full screen keeps only what you reach for WHILE playing — Listen,
// Practice/Stop, progress, restart, tempo, and the fingering-editor workspace. Settings
// belong to the run you set up before playing, not mid-flight, so the whole run-setup
// panel lives inline before play, folded behind a disclosure, and full screen carries no
// settings of its own. Every button drives a session action; the bar holds no state but
// the tempo popover's.
export function PlayTransport() {
    const {
        ready,
        matcher,
        keepUp,
        listenPlayback,
        enforceTempo,
        listen,
        restartListen,
        practice,
        playAlong,
        fingerStrip,
        setFingerStrip,
        exitFullscreen,
        tempo,
        setTempo,
        lockTempo,
    } = usePlaySession();

    // Listen lives only in the full-screen top bar. Playing enters full screen on every
    // device, so that is the one place it's reachable — which keeps the inline /play view to
    // a single primary action (Practice), the piece's front door.
    //
    // Both transport buttons keep a constant label and a single icon slot that flips
    // play ↔ stop, so starting or stopping never reflows the bar: the label is the
    // button's identity, the icon (plus aria-pressed) is its state. Listen wears the
    // speaker — playback you hear — leaving the play triangle to Practice, the mode
    // where you play.
    const listenButton = (
        <Button
            variant="secondary"
            disabled={!ready || keepUp.running}
            aria-pressed={listenPlayback.playing}
            onClick={() => (listenPlayback.playing ? listenPlayback.stop() : listen())}
        >
            {listenPlayback.playing ? <StopIcon /> : <SpeakerIcon />}
            {m.action_listen()}
        </Button>
    );
    // Practice is the screen's primary action, so it carries the dominant filled variant.
    // It enters full screen first, then starts the run; with "keep up" on it starts a
    // tempo-locked play-along instead of the self-paced run.
    const practiceRunning = matcher.practicing || keepUp.running;
    const practiceButton = (
        <Button
            variant="primary"
            disabled={!ready}
            aria-pressed={practiceRunning}
            onClick={() => {
                if (matcher.practicing) {
                    matcher.stop();
                } else if (keepUp.running) {
                    keepUp.stop();
                } else if (enforceTempo) {
                    playAlong();
                } else {
                    practice();
                }
            }}
        >
            {practiceRunning ? <StopIcon /> : <PlayIcon />}
            {m.action_practice()}
        </Button>
    );
    // Opens the Runs drawer: your saved performances of this piece. Kept out of the main
    // column so browsing them, sharing your last run, or replaying one never clutters the
    // resting play view. Not for an ephemeral piece, which can't be saved.
    return (
        <>
            <FullScreen>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {listenButton}
                    {practiceButton}
                    <Show when={matcher.practicing}>
                        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                            {matcher.done}/{matcher.total}
                        </span>
                    </Show>
                    <Show when={keepUp.running}>
                        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                            {keepUp.progress.inTime}/{keepUp.progress.done}
                        </span>
                    </Show>
                    {/* Restart from the first note — a fresh practice run, or Listen
                    taken back to the top. */}
                    <Show when={matcher.practicing || listenPlayback.playing}>
                        <IconButton
                            onClick={() => (matcher.practicing ? practice(false) : restartListen())}
                            label={m.action_restart()}
                        >
                            <RotateIcon />
                        </IconButton>
                    </Show>
                    {/* The one shared tempo, adjustable mid-play: a BPM readout that
                    opens a small slider popover. Hidden for a locked challenge. */}
                    {!lockTempo && <TempoPopover tempo={tempo} setTempo={setTempo} />}
                    {/* Swap the keyboard area for the fingering editor: work out (or
                    fine-tune) the fingers for the piece with the difficulty heat-map
                    washed over the score. A workspace, not a setting, so it stays on
                    the bar. */}
                    <ToggleIconButton
                        onClick={() => setFingerStrip((on: boolean) => !on)}
                        pressed={fingerStrip}
                        label={m.action_fingering_editor()}
                    >
                        <FingersIcon />
                    </ToggleIconButton>
                    <IconButton
                        variant="primary"
                        onClick={exitFullscreen}
                        label={m.action_exit_fullscreen()}
                        className="ml-auto"
                    >
                        <CloseIcon />
                    </IconButton>
                </div>
            </FullScreen>
            {/* Inline, a single primary action sits above the score so it's the first
            thing in reach — Practice enters full screen and starts the run. Listen and
            the rest of the transport live in the full-screen top bar (above), reachable
            once play begins, so the resting /play view stays uncluttered. */}
            <FullScreen off>
                {/* Run setup sits right beside Practice — the disclosure's button
                joins the action row, its panel wraps to a full-width line below. */}
                <div className="flex flex-wrap items-center gap-3">
                    {practiceButton}
                    <RunSetup />
                </div>
            </FullScreen>
        </>
    );
}

// The BPM readout that doubles as the mid-play tempo control: tapping it opens
// a small popover with the slider, so the transport carries one compact number
// instead of a full-width row.
function TempoPopover({ tempo, setTempo }: { tempo: number; setTempo: (value: number) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <span className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={m.scores_tempo()}
                className="min-h-11 rounded-md px-2 text-sm font-semibold tabular-nums text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
                <Bpm tempo={tempo} />
            </button>
            {open && (
                <span className="absolute left-0 top-full z-30 mt-1 flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <span className="flex items-center gap-2">
                        <input
                            type="range"
                            min={40}
                            max={180}
                            value={tempo}
                            onChange={(event) => setTempo(Number(event.target.value))}
                            aria-label={m.scores_tempo()}
                        />
                        <BumpValue
                            value={tempo}
                            className="w-10 text-sm font-semibold text-gray-800 dark:text-gray-200"
                        />
                    </span>
                    {/* The speed as music: the classical term for the current mark. */}
                    <span className="text-xs italic text-gray-500 dark:text-gray-400">
                        {tempoTerm(tempo)}
                    </span>
                </span>
            )}
        </span>
    );
}
