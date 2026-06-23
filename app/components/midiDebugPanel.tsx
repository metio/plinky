// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMidiConnection } from "../contexts/midi";
import { noteName } from "../lib/midi";
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
                <h1 className="text-2xl font-semibold">MIDI debug</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Connect a digital piano and confirm note events arrive in the browser.
                </p>
            </header>

            {support === "unsupported" && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    This browser does not expose the Web MIDI API. Use Chrome, Edge, or Firefox on
                    desktop or Android — Safari (macOS and iOS) is not supported.
                </p>
            )}

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={requestAccess}
                    disabled={support !== "supported" || status === "requesting"}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                    {status === "ready" ? "Reconnect" : "Connect MIDI"}
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {support === "unknown" && "Checking browser support…"}
                    {status === "requesting" && "Requesting access…"}
                    {status === "ready" &&
                        `${devices.length} input${devices.length === 1 ? "" : "s"} connected`}
                    {status === "denied" && "Access denied."}
                    {status === "error" && (error ?? "Something went wrong.")}
                </span>
            </div>

            {error && status !== "error" && <p className="text-sm text-red-600">{error}</p>}

            <KeyboardHint octaveOffset={octaveOffset} />

            <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Inputs
                </h2>
                {devices.length === 0 ? (
                    <p className="text-sm text-gray-400">No inputs detected.</p>
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
                                    <span className="text-gray-400">· {device.manufacturer}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Held notes
                </h2>
                {heldNotes.length === 0 ? (
                    <p className="text-sm text-gray-400">Press a key…</p>
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
                        Event log
                    </h2>
                    <button
                        type="button"
                        onClick={clearEvents}
                        disabled={events.length === 0}
                        className="text-xs text-gray-500 dark:text-gray-400 underline disabled:opacity-40"
                    >
                        Clear
                    </button>
                </div>
                {events.length === 0 ? (
                    <p className="text-sm text-gray-400">Waiting for note events…</p>
                ) : (
                    <table className="w-full font-mono text-xs">
                        <thead className="text-left text-gray-400">
                            <tr>
                                <th className="py-1 pr-4 font-normal">Time</th>
                                <th className="py-1 pr-4 font-normal">Type</th>
                                <th className="py-1 pr-4 font-normal">Note</th>
                                <th className="py-1 pr-4 font-normal">Vel</th>
                                <th className="py-1 pr-4 font-normal">Ch</th>
                                <th className="py-1 font-normal">Device</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr
                                    key={event.id}
                                    className={
                                        event.kind === "noteon"
                                            ? "text-gray-900 dark:text-gray-100"
                                            : "text-gray-400"
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
