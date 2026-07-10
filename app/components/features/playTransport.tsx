// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { Button, IconButton } from "../ui/button";
import {
    CloseIcon,
    EyeIcon,
    HandIcon,
    ListIcon,
    PlayIcon,
    RotateIcon,
    SlidersIcon,
    SpeakerIcon,
    StopIcon,
} from "../ui/icons";
import { FullScreen, Show } from "./conditional";
import { usePlaySession } from "./playSession";

// The play controls: a rich full-screen top bar (Listen, Practice/Stop, progress, restart,
// the fingering and follow toggles, settings, hide-keyboard, exit) and, inline before play
// begins, a single primary Practice plus the settings and runs entries. Every button drives
// a session action; the bar holds no state of its own.
export function PlayTransport() {
    const {
        ready,
        ephemeral,
        matcher,
        keepUp,
        listenPlayback,
        enforceTempo,
        listen,
        restartListen,
        practice,
        playAlong,
        getOsmd,
        reading,
        hideKeyboard,
        setHideKeyboard,
        setToolsOpen,
        setRunsOpen,
        exitFullscreen,
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
    // Opens the Practice-tools drawer. A sliders icon, deliberately not a gear — the
    // header gear is the app's global /settings, these are the per-piece knobs.
    const toolsButton = (
        <Button variant="secondary" onClick={() => setToolsOpen(true)}>
            <SlidersIcon />
            {m.more_options()}
        </Button>
    );
    // Opens the Runs drawer: your saved performances of this piece. Kept out of the main
    // column so browsing them, sharing your last run, or replaying one never clutters the
    // resting play view. Not for an ephemeral piece, which can't be saved.
    const runsButton = !ephemeral && (
        <Button variant="secondary" onClick={() => setRunsOpen(true)}>
            <ListIcon />
            {m.takes_button()}
        </Button>
    );

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
                    <IconButton
                        onClick={() => setShowFingerings((on) => !on)}
                        aria-pressed={showFingerings}
                        label={m.action_finger_numbers()}
                        className={showFingerings ? "text-indigo-600 dark:text-indigo-400" : ""}
                    >
                        <HandIcon />
                    </IconButton>
                    {/* Turn the follow-the-note scrolling off to read at your own pace,
                    or on to let the staff keep up. Moot in treadmill, which scrolls
                    itself. */}
                    <Show when={!treadmill}>
                        <IconButton
                            onClick={() => {
                                const next = !scrollFollow;
                                setScrollFollow(next);
                                const osmd = getOsmd();
                                if (osmd) {
                                    osmd.FollowCursor = next;
                                }
                            }}
                            aria-pressed={scrollFollow}
                            label={m.action_scroll_follow()}
                            className={scrollFollow ? "text-indigo-600 dark:text-indigo-400" : ""}
                        >
                            <EyeIcon />
                        </IconButton>
                    </Show>
                    {/* The Practice-tools drawer — tempo, loop, metronome, keep-up and
                    the rest — reachable without leaving full screen. */}
                    <IconButton onClick={() => setToolsOpen(true)} label={m.more_options()}>
                        <SlidersIcon />
                    </IconButton>
                    <Button
                        variant="secondary"
                        onClick={() => setHideKeyboard((on) => !on)}
                        aria-pressed={hideKeyboard}
                        className="ml-auto"
                    >
                        {hideKeyboard ? m.action_show_keyboard() : m.action_hide_keyboard()}
                    </Button>
                    <IconButton
                        variant="primary"
                        onClick={exitFullscreen}
                        label={m.action_exit_fullscreen()}
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
                <div className="flex flex-wrap items-center gap-3">
                    {practiceButton}
                    {toolsButton}
                    {runsButton}
                </div>
            </FullScreen>
        </>
    );
}
