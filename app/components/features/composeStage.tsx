// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useRef } from "react";
import type { Span } from "../../../core/keyboardWindow";
import { useMidiConnection } from "../../contexts/midi";
import { useFullscreen } from "../../hooks/useFullscreen";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { KeyboardHint } from "../ui/keyboardHint";
import { FullscreenProvider } from "./conditional";
import { MidiConnectPrompt } from "./midiConnectPrompt";
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
};

// The composing surface: the recording controls, the staff sketch, the windowed
// on-screen keyboard, and the same keyboard chrome the play page has — the
// connect-your-piano prompt, the computer-keys hint, and a full-screen mode
// that gives the sketch and the keys the whole display.
export function ComposeStage({ staffXml, keyWindow, controls }: ComposeStageProps) {
    const stageRef = useRef<HTMLDivElement>(null);
    const { fullscreen, enter, exit } = useFullscreen(stageRef);
    const { octaveOffset } = useMidiConnection();

    return (
        <FullscreenProvider active={fullscreen}>
            <section
                ref={stageRef}
                className={
                    fullscreen
                        ? "fixed inset-0 z-50 flex flex-col justify-between gap-3 overflow-y-auto bg-white p-4 dark:bg-gray-950"
                        : "space-y-3"
                }
            >
                {controls}
                <div className={fullscreen ? "min-h-0 flex-1 overflow-y-auto" : ""}>
                    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
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
                <div className="space-y-3">
                    <PianoKeyboard from={keyWindow.from} to={keyWindow.to} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <MidiConnectPrompt />
                        <Button
                            variant="ghost"
                            onClick={fullscreen ? exit : enter}
                            aria-pressed={fullscreen}
                        >
                            {fullscreen ? m.action_exit_fullscreen() : m.action_enter_fullscreen()}
                        </Button>
                    </div>
                    {/* The computer-keys mapping stays out of full screen — the keys
                        themselves are the surface there. */}
                    {!fullscreen && <KeyboardHint octaveOffset={octaveOffset} />}
                </div>
            </section>
        </FullscreenProvider>
    );
}
