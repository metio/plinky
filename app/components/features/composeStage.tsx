// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, type RefObject, useState } from "react";
import type { Span } from "../../../core/keyboardWindow";
import { usePrefsStore } from "../../contexts/services";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { m } from "../../paraglide/messages.js";
import { IconButton } from "../ui/button";
import { CloseIcon } from "../ui/icons";
import { FullscreenProvider } from "./conditional";
import { KeyboardQuickControls } from "./keyboardQuickControls";
import { PianoKeyboard } from "./pianoKeyboard";
import { StaffPreview } from "./staffPreview";

type ComposeStageProps = {
    // The engraved sketch of the take; null while the canvas is empty.
    staffXml: string | null;
    // The two-octave window the on-screen keyboard shows.
    keyWindow: Span;
    // The recording controls, rendered inside the stage so they stay in reach
    // in full screen.
    controls: ReactNode;
    // The stage element the route's useFullscreen drives — Count in enters,
    // the ✕ (or Esc) leaves.
    stageRef: RefObject<HTMLElement | null>;
    fullscreen: boolean;
    onExitFullscreen: () => void;
};

// The composing surface. At rest it is just the controls and the growing staff
// sketch — no keyboard, no chrome. Count in drops into full screen the way
// Practice does on a play page, and only there do the on-screen keys appear,
// with the same quick controls play uses to relabel or fold them away.
export function ComposeStage({
    staffXml,
    keyWindow,
    controls,
    stageRef,
    fullscreen,
    onExitFullscreen,
}: ComposeStageProps) {
    const prefsStore = usePrefsStore();
    const noteLabels = useNoteLabels();
    const [hideKeyboard, setHideKeyboard] = useState(false);

    return (
        <FullscreenProvider active={fullscreen}>
            <section
                ref={stageRef as RefObject<HTMLElement>}
                className={
                    fullscreen
                        ? "fixed inset-0 z-50 flex flex-col justify-between gap-3 overflow-y-auto bg-white p-4 dark:bg-gray-950"
                        : "space-y-3"
                }
            >
                <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">{controls}</div>
                    {fullscreen && (
                        <IconButton
                            variant="primary"
                            onClick={onExitFullscreen}
                            label={m.action_exit_fullscreen()}
                            className="shrink-0"
                        >
                            <CloseIcon />
                        </IconButton>
                    )}
                </div>
                <div className={fullscreen ? "flex min-h-0 flex-1 flex-col" : ""}>
                    <div
                        className={`rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 ${
                            fullscreen ? "relative min-h-0 flex-1 overflow-y-auto" : ""
                        }`}
                    >
                        {/* The keys' quick controls ride the sketch's corner, the same
                            placement play uses — so folding the keys away hands their
                            whole strip to the staff. */}
                        {fullscreen && (
                            <KeyboardQuickControls
                                floating
                                hidden={hideKeyboard}
                                onToggleHidden={() => setHideKeyboard((on) => !on)}
                                noteLabels={noteLabels}
                                onNoteLabels={(value) =>
                                    prefsStore.save({ ...prefsStore.load(), noteLabels: value })
                                }
                            />
                        )}
                        {staffXml ? (
                            <StaffPreview xml={staffXml} label={m.compose_staff_label()} />
                        ) : (
                            <p className="px-2 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                {m.compose_staff_empty()}
                            </p>
                        )}
                    </div>
                    {!fullscreen && (
                        <p className="pt-3 text-xs text-gray-500 dark:text-gray-400">
                            {m.compose_sketch_note()}
                        </p>
                    )}
                </div>
                {/* The keys live in full screen only — the same surface play grants
                    a run — and only while shown, so hiding them leaves no stray row. */}
                {fullscreen && !hideKeyboard && (
                    <PianoKeyboard from={keyWindow.from} to={keyWindow.to} />
                )}
            </section>
        </FullscreenProvider>
    );
}
