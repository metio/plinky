// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, type RefObject, useCallback, useRef, useState } from "react";
import { atEnd } from "../../../core/followScroll";
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

    // The sketch grows downward as you play, so the notes you just played are the ones
    // at the bottom — and without this the panel keeps its scroll position and your own
    // playing disappears below the fold. It follows only while you are already at the
    // end of it, so scrolling back to look at an earlier bar keeps you there.
    //
    // Driven off the staff's own render rather than off the XML changing: the engraving
    // is asynchronous, and scrolling before it lands measures the previous staff.
    const sketchRef = useRef<HTMLDivElement>(null);
    const followRef = useRef(true);
    const onStaffRendered = useCallback(() => {
        const box = sketchRef.current;
        if (box && followRef.current) {
            box.scrollTop = box.scrollHeight;
        }
    }, []);

    return (
        <FullscreenProvider active={fullscreen}>
            <section
                ref={stageRef as RefObject<HTMLElement>}
                className={
                    fullscreen
                        ? "fixed inset-0 z-50 flex flex-col justify-between gap-3 overflow-y-auto bg-surface p-4"
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
                        ref={sketchRef}
                        onScroll={(event) => {
                            followRef.current = atEnd(event.currentTarget);
                        }}
                        // Bounded either way, so the sketch is a panel that scrolls rather
                        // than a block that grows without end — outside full screen an
                        // unbounded staff pushes the recording controls off the screen,
                        // which is the same complaint from the other side.
                        className={`overflow-y-auto rounded-lg border border-line bg-raised p-3 ${
                            fullscreen ? "relative min-h-0 flex-1" : "max-h-[60vh]"
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
                            <StaffPreview
                                xml={staffXml}
                                label={m.compose_staff_label()}
                                onRendered={onStaffRendered}
                            />
                        ) : (
                            <p className="px-2 py-10 text-center text-sm text-muted">
                                {m.compose_staff_empty()}
                            </p>
                        )}
                    </div>
                    {!fullscreen && (
                        <p className="pt-3 text-xs text-muted">{m.compose_sketch_note()}</p>
                    )}
                </div>
                {/* The keys are always here. A phone has no MIDI socket and no computer
                    keyboard, so without them the page offers a touch visitor no way to
                    make a sound at all — and the page's own opening line promises "the
                    keys below". Full screen gives them the width; resting, they sit under
                    the sketch as the invitation the home page makes with the same keys. */}
                {!hideKeyboard && <PianoKeyboard from={keyWindow.from} to={keyWindow.to} />}
            </section>
        </FullscreenProvider>
    );
}
