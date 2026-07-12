// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { MIC_DEVICE } from "../../../core/midi";
import { noteName } from "../../../core/midi";
import { useMidiConnection, useMidiInput } from "../../contexts/midi";
import { useState } from "react";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";

// Hear an acoustic piano and confirm it works: the listen button, the state of
// the microphone, and a live read-out of the last note Plinky heard — so a
// player can strike a key and see it recognized before starting a piece.
// Settings hides this whole block where no microphone API exists.
export function MicConnect() {
    const { micStatus, startMic, stopMic } = useMidiConnection();
    const [heard, setHeard] = useState<number | null>(null);

    useMidiInput({
        onNoteOn: (event) => {
            if (event.device === MIC_DEVICE) {
                setHeard(event.note);
            }
        },
    });

    const listening = micStatus === "listening";
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <Button
                    variant={listening ? "secondary" : "primary"}
                    disabled={micStatus === "requesting"}
                    onClick={listening ? stopMic : startMic}
                >
                    {listening ? m.mic_stop() : m.mic_listen()}
                </Button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {micStatus === "requesting" && m.mic_requesting()}
                    {micStatus === "listening" && m.mic_listening()}
                    {micStatus === "denied" && m.mic_denied()}
                    {micStatus === "error" && m.mic_error()}
                </span>
            </div>

            {listening && (
                <p className="text-sm text-gray-700 dark:text-gray-300" role="status">
                    {heard === null ? (
                        m.mic_play_something()
                    ) : (
                        <>
                            {m.mic_heard()}{" "}
                            <span className="rounded-md bg-indigo-100 px-2 py-1 font-mono text-sm text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
                                {noteName(heard)}
                            </span>
                        </>
                    )}
                </p>
            )}
        </div>
    );
}
