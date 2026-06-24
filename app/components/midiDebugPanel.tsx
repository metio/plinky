// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMidiConnection } from "../contexts/midi";
import { noteName } from "../lib/midi";
import { m } from "../paraglide/messages.js";
import { KeyboardHint } from "./keyboardHint";

function formatTime(ms: number): string {
    // MIDIMessageEvent timestamps are milliseconds since the page's time
    // origin, so show seconds with millisecond precision for ordering.
    return `${(ms / 1000).toFixed(3)}s`;
}

export function MidiDebugPanel() {
    const {
        support,
        status,
        error,
        devices,
        events,
        heldNotes,
        octaveOffset,
        requestAccess,
        clearEvents,
    } = useMidiConnection();

    return (
        <section className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.midi_debug_heading()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.midi_debug_intro()}</p>
            </header>

            {support === "unsupported" && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    {m.midi_debug_unsupported()}
                </p>
            )}

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
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.midi_debug_inputs()}
                </h2>
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
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.midi_debug_held_notes()}
                </h2>
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

            <div>
                <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {m.midi_debug_event_log()}
                    </h2>
                    <button
                        type="button"
                        onClick={clearEvents}
                        disabled={events.length === 0}
                        className="text-xs text-gray-500 dark:text-gray-400 underline disabled:opacity-40"
                    >
                        {m.midi_debug_clear()}
                    </button>
                </div>
                {events.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.midi_debug_waiting()}
                    </p>
                ) : (
                    <table className="w-full font-mono text-xs">
                        <thead className="text-left text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="py-1 pr-4 font-normal">{m.midi_debug_col_time()}</th>
                                <th className="py-1 pr-4 font-normal">{m.midi_debug_col_type()}</th>
                                <th className="py-1 pr-4 font-normal">{m.midi_debug_col_note()}</th>
                                <th className="py-1 pr-4 font-normal">{m.midi_debug_col_vel()}</th>
                                <th className="py-1 pr-4 font-normal">{m.midi_debug_col_ch()}</th>
                                <th className="py-1 font-normal">{m.midi_debug_col_device()}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr
                                    key={event.id}
                                    className={
                                        event.kind === "noteon"
                                            ? "text-gray-900 dark:text-gray-100"
                                            : "text-gray-500 dark:text-gray-400"
                                    }
                                >
                                    <td className="py-0.5 pr-4">{formatTime(event.timestamp)}</td>
                                    <td className="py-0.5 pr-4">{event.kind}</td>
                                    <td className="py-0.5 pr-4">
                                        {event.noteName} ({event.note})
                                    </td>
                                    <td className="py-0.5 pr-4">{event.velocity}</td>
                                    <td className="py-0.5 pr-4">{event.channel}</td>
                                    <td className="py-0.5">{event.device}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    );
}
