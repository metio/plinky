// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMidiConnection } from "../contexts/midi";
import { noteName } from "../lib/midi";
import { m } from "../paraglide/messages.js";
import { KeyboardHint } from "./keyboardHint";

// Connect a MIDI keyboard and confirm it works: the connect button, the inputs it
// finds, and a live read-out of the keys being pressed. Settings hides this whole
// block where Web MIDI is unsupported, so there's no unsupported state here.
export function MidiConnect() {
    const { support, status, error, devices, heldNotes, octaveOffset, requestAccess } =
        useMidiConnection();

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={requestAccess}
                    disabled={support !== "supported" || status === "requesting"}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                    {status === "ready" ? m.midi_debug_reconnect() : m.midi_connect()}
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
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

            {error && status !== "error" && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <KeyboardHint octaveOffset={octaveOffset} />

            <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.midi_debug_inputs()}
                </h3>
                {devices.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.midi_debug_no_inputs()}
                    </p>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {devices.map((device) => (
                            <li key={device.id} className="flex items-center gap-2">
                                <span
                                    className={`inline-block h-2 w-2 rounded-full ${
                                        device.state === "connected"
                                            ? "bg-green-500"
                                            : "bg-gray-300"
                                    }`}
                                />
                                <span className="font-medium">{device.name}</span>
                                {device.manufacturer && (
                                    <span className="text-gray-500 dark:text-gray-400">
                                        · {device.manufacturer}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.midi_debug_held_notes()}
                </h3>
                {heldNotes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.midi_debug_press_key()}
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {heldNotes.map((note) => (
                            <span
                                key={note}
                                className="rounded-md bg-indigo-100 px-2 py-1 font-mono text-sm text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100"
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
