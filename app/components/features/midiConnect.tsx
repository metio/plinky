// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMidiConnection, useHeldNotes } from "../../contexts/midi";
import { noteName } from "../../../core/midi";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { KeyboardHint } from "../ui/keyboardHint";
import { sectionLabelClasses } from "../ui/classes";

// Connect a MIDI keyboard and confirm it works: the connect button, the inputs it
// finds, and a live read-out of the keys being pressed. Settings hides this whole
// block where Web MIDI is unsupported, so there's no unsupported state here.
export function MidiConnect() {
    const heldNotes = useHeldNotes();
    const { support, status, error, devices, octaveOffset, requestAccess } = useMidiConnection();

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Button
                    variant="primary"
                    onClick={requestAccess}
                    disabled={support !== "supported" || status === "requesting"}
                >
                    {status === "ready" ? m.midi_debug_reconnect() : m.midi_connect()}
                </Button>
                <span className="text-sm text-muted">
                    {support === "unknown" && m.midi_debug_checking()}
                    {status === "requesting" && m.midi_debug_requesting()}
                    {status === "ready" &&
                        (devices.length === 1
                            ? m.midi_debug_inputs_connected_one({ count: devices.length })
                            : m.midi_debug_inputs_connected_other({ count: devices.length }))}
                    {status === "denied" && m.midi_debug_denied()}
                    {status === "error" && (error ?? m.midi_debug_error())}
                </span>
            </div>

            {error && status !== "error" && <p className="text-sm text-danger">{error}</p>}

            <KeyboardHint octaveOffset={octaveOffset} />

            <div>
                <h3 className={`mb-2 ${sectionLabelClasses}`}>{m.midi_debug_inputs()}</h3>
                {devices.length === 0 ? (
                    <p className="text-sm text-muted">{m.midi_debug_no_inputs()}</p>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {devices.map((device) => (
                            <li key={device.id} className="flex items-center gap-2">
                                <span
                                    className={`inline-block h-2 w-2 rounded-full ${
                                        device.state === "connected"
                                            ? "bg-key-held"
                                            : "bg-key-spent"
                                    }`}
                                />
                                <span className="font-medium">{device.name}</span>
                                {device.manufacturer && (
                                    <span className="text-muted">· {device.manufacturer}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div>
                <h3 className={`mb-2 ${sectionLabelClasses}`}>{m.midi_debug_held_notes()}</h3>
                {heldNotes.length === 0 ? (
                    <p className="text-sm text-muted">{m.midi_debug_press_key()}</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {heldNotes.map((note) => (
                            <span
                                key={note}
                                className="rounded-md bg-accent-fill px-2 py-1 font-mono text-sm text-accent-deep"
                            >
                                {noteName(note)} ({note})
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
