// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { GhostTrack } from "../ui/ghostTrack";
import { CloseIcon } from "../ui/icons";
import { FocusStrip } from "./focusStrip";
import { FullScreen, Midi, Show } from "./conditional";
import { PianoKeyboard } from "./pianoKeyboard";
import { usePlaySession } from "./playSession";

// The practice stage — everything below the score: the progress + MIDI-connect row, the
// ghost race track, the turn-your-phone nudge, the mobile focus strip, and the on-screen
// keyboard. The run-bound rows show only while practising; the keyboard also stays up
// through all of full screen (unless hidden from the top bar), so the keys are there to
// noodle on before a run starts and the "Show keys" toggle always has keys to show.
export function PlayStage() {
    const {
        matcher,
        fullscreen,
        compact,
        connected,
        status,
        requestAccess,
        ghostRace,
        portrait,
        coarsePointer,
        rotateDismissed,
        dismissRotate,
        focusXml,
        hideKeyboard,
        keyWindow,
        hintNotes,
    } = usePlaySession();

    return (
        <Show when={matcher.practicing || fullscreen}>
            <div className={`space-y-2 ${fullscreen ? "shrink-0" : ""}`}>
                {/* Full screen keeps only the score and the keys; its progress count
                rides in the top bar, so this full-width status row is dropped. */}
                <FullScreen off>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                            {m.play_progress()} {matcher.done} / {matcher.total}
                        </span>
                        <Midi supported>
                            <Show when={!connected}>
                                <Button variant="primary" onClick={requestAccess}>
                                    {status === "requesting"
                                        ? m.midi_connecting()
                                        : m.midi_connect()}
                                </Button>
                            </Show>
                        </Midi>
                        <Midi unsupported>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {m.midi_unsupported_keyboard()}
                            </span>
                        </Midi>
                    </div>
                </FullScreen>
                {/* The race track rides along in full screen too — a thin bar below
                the score — so racing a ghost survives the move to always-full-screen
                play; without it the race would be invisible whenever you play. */}
                <Show when={matcher.practicing && ghostRace.ghost}>
                    <GhostTrack
                        you={matcher.done}
                        ghost={ghostRace.ghostDone}
                        total={matcher.total}
                    />
                </Show>
                <FullScreen off>
                    <Show
                        when={
                            compact && portrait && coarsePointer && !connected && !rotateDismissed
                        }
                    >
                        <div className="flex items-center justify-between gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                            <span>{m.rotate_hint()}</span>
                            <button
                                type="button"
                                onClick={dismissRotate}
                                aria-label={m.action_dismiss()}
                                className="shrink-0 p-1"
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </Show>
                </FullScreen>
                {/* On a phone (portrait or landscape), a compact current-bars strip
                right above the keys, so the notes to play aren't scrolled off
                behind the keyboard; bigger screens — and full screen, where the
                single score already fills the height — rely on the auto-scrolling
                full score above. */}
                <FullScreen off>
                    <Show when={compact}>
                        <FocusStrip
                            xml={focusXml}
                            bar={matcher.bar}
                            label={m.focus_strip_label()}
                        />
                    </Show>
                </FullScreen>
                <Show when={!(fullscreen && hideKeyboard)}>
                    <PianoKeyboard
                        expected={hintNotes}
                        wrong={matcher.lastWrong}
                        from={keyWindow?.from}
                        to={keyWindow?.to}
                    />
                </Show>
            </div>
        </Show>
    );
}
