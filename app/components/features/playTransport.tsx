// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { tempoTerm } from "../../../core/tempoTerm";
import { m } from "../../paraglide/messages.js";
import { Bpm } from "../ui/bpm";
import { BumpValue } from "../ui/stepper";
import { ToggleIconButton } from "../ui/toggleIconButton";
import { Button, IconButton } from "../ui/button";
import {
    CloseIcon,
    EyeIcon,
    FingersIcon,
    HandIcon,
    PlayIcon,
    RotateIcon,
    ForwardIcon,
    SpeakerIcon,
    StopIcon,
    MetronomeIcon,
} from "../ui/icons";
import { FullScreen, Show } from "./conditional";
import { usePlaySession } from "./playSession";
import { RunSetup } from "./runSetup";

// The play controls: a rich full-screen top bar (Listen, Practice/Stop, progress, restart,
// the fingering and follow toggles, settings, hide-keyboard, exit) and, inline before play
// begins, a single primary Practice plus the settings and runs entries. Every button drives
// a session action; the bar holds no state of its own.
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
        reading,
        fingerStrip,
        setFingerStrip,
        exitFullscreen,
        metronomeOn,
        setMetronomeOn,
        forgiving,
        setForgiving,
        tempo,
        setTempo,
        lockTempo,
    } = usePlaySession();
    const { showFingerings, setShowFingerings, treadmill, scrollFollow, setScrollFollow } = reading;

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
                    {/* Show/hide the fingering numbers on the staff without leaving the
                    music — seeded from the setting, flipped here for this session. */}
                    <ToggleIconButton
                        onClick={() => setShowFingerings((on) => !on)}
                        pressed={showFingerings}
                        label={m.action_finger_numbers()}
                    >
                        <HandIcon />
                    </ToggleIconButton>
                    {/* Turn the follow-the-note scrolling off to read at your own pace,
                    or on to let the staff keep up. Moot in treadmill, which scrolls
                    itself. */}
                    <Show when={!treadmill}>
                        <ToggleIconButton
                            onClick={() => setScrollFollow((on) => !on)}
                            pressed={scrollFollow}
                            label={m.action_scroll_follow()}
                        >
                            <EyeIcon />
                        </ToggleIconButton>
                    </Show>
                    {/* The metronome, one tap from the music — its finer settings
                    (adaptive, subdivision) stay in the drawer. */}
                    <ToggleIconButton
                        onClick={() => setMetronomeOn(!metronomeOn)}
                        pressed={metronomeOn}
                        label={m.action_metronome()}
                    >
                        <MetronomeIcon />
                    </ToggleIconButton>
                    {/* The one shared tempo, adjustable mid-play: a BPM readout that
                    opens a small slider popover. Hidden for a locked challenge. */}
                    {!lockTempo && <TempoPopover tempo={tempo} setTempo={setTempo} />}
                    {/* Keep going past a slip without leaving the music — read live
                    by the matcher, so it takes effect on the very next note. */}
                    <ToggleIconButton
                        onClick={() => setForgiving(!forgiving)}
                        pressed={forgiving}
                        label={m.forgiving_toggle()}
                    >
                        <ForwardIcon />
                    </ToggleIconButton>
                    {/* Swap the keyboard area for the fingering editor: work out (or
                    fine-tune) the fingers for the piece with the difficulty heat-map
                    washed over the score. */}
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
