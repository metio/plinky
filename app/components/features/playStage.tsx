// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback } from "react";
import { m } from "../../paraglide/messages.js";
import { GhostTrack } from "../ui/ghostTrack";
import { CloseIcon } from "../ui/icons";
import { FingeringStrip } from "./fingeringStrip";
import { FocusStrip } from "./focusStrip";
import { FullScreen, Show } from "./conditional";
import { NotesHighway } from "./notesHighway";
import { PianoKeyboard } from "./pianoKeyboard";
import { usePlaySession } from "./playSession";

// The practice stage — everything below the score: the progress + MIDI-connect row, the
// ghost race track, the turn-your-phone nudge, the mobile focus strip, and the on-screen
// keyboard. The run-bound rows show only while practising; the keyboard also stays up
// through all of full screen (unless folded away from the score corner's quick
// controls), so the keys are there to noodle on before a run starts.
export function PlayStage() {
    const {
        matcher,
        fullscreen,
        compact,
        connected,
        ghostRace,
        portrait,
        coarsePointer,
        rotateDismissed,
        dismissRotate,
        focusXml,
        hideKeyboard,
        fingerStrip,
        hintNotes,
        holdFractions,
        keyRange,
        reading,
        id,
        xml,
        staffCount,
        containerRef,
        score,
    } = usePlaySession();

    // A stable handle to the rendered score SVG, so the strip's heat effect only
    // repaints when the render actually changes, not on every stage re-render.
    const getSvg = useCallback(() => {
        const found = containerRef.current?.querySelector("svg");
        return found instanceof SVGSVGElement ? found : null;
    }, [containerRef]);

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
                {/* In fullscreen the fingering editor takes the keyboard's slot when
                    toggled from the transport; otherwise the keys show unless hidden. */}
                {fullscreen && fingerStrip ? (
                    <FingeringStrip
                        id={id}
                        xml={xml}
                        staffCount={staffCount}
                        svg={getSvg}
                        measureBoxes={score.measureBoxes}
                        renderVersion={score.renderVersion}
                    />
                ) : (
                    <Show when={!(fullscreen && hideKeyboard)}>
                        {/* The notes highway rides right above the keys, aligned to
                        the same lanes, while practising with the highway aid on. */}
                        <Show when={reading.highway && matcher.practicing}>
                            <NotesHighway
                                upcoming={matcher.upcoming}
                                from={keyRange.from}
                                to={keyRange.to}
                            />
                        </Show>
                        <PianoKeyboard
                            expected={hintNotes}
                            wrong={matcher.lastWrong}
                            holds={holdFractions}
                            from={keyRange.from}
                            to={keyRange.to}
                            // Full screen is the playing surface — let the keys use
                            // the whole page width instead of the capped rest well.
                            well={fullscreen ? "w-full" : undefined}
                        />
                    </Show>
                )}
            </div>
        </Show>
    );
}
