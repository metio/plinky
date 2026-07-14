// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMidiConnection } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { useMidiConnected } from "./conditional";
import { CheckIcon, PlugIcon } from "../ui/icons";

// A small status dot in the corner of every keyboard: a green tick the moment a MIDI
// piano is connected — a little reward — and an unobtrusive grey plug otherwise, read
// as "you could plug a piano in", not "something is broken". Where the browser has no
// Web MIDI at all (Safari, every iOS), connecting is impossible and the on-screen keys
// are the instrument, so the badge is hidden rather than showing a permanent failure.
export function MidiBadge() {
    const { support } = useMidiConnection();
    const connected = useMidiConnected();
    if (support === "unsupported") {
        return null;
    }

    const label = connected ? m.midi_badge_connected() : m.midi_badge_disconnected();
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={`pointer-events-none absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full ${
                connected
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
            }`}
        >
            {connected ? (
                <CheckIcon className="h-3.5 w-3.5" />
            ) : (
                <PlugIcon className="h-3.5 w-3.5" />
            )}
        </span>
    );
}
