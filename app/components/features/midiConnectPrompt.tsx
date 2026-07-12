// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMidiConnection } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { Midi, Show, useMidiConnected } from "./conditional";

// The one-line "plug in your piano" prompt every playing surface shares: a
// connect button while a supported browser has no MIDI device attached, a short
// unsupported note otherwise, and nothing once connected. The full diagnostic
// panel (device list, live key read-out) stays on the Settings page.
export function MidiConnectPrompt() {
    const { status, requestAccess } = useMidiConnection();
    const connected = useMidiConnected();
    return (
        <>
            <Midi supported>
                <Show when={!connected}>
                    <Button variant="primary" onClick={requestAccess}>
                        {status === "requesting" ? m.midi_connecting() : m.midi_connect()}
                    </Button>
                </Show>
            </Midi>
            <Midi unsupported>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {m.midi_unsupported_keyboard()}
                </span>
            </Midi>
        </>
    );
}
