// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../paraglide/messages.js";

// A race track read at a glance while playing: the player (🎹) and the ghost (👻)
// slide along one bar by how far each has reached, so the gap between them — who's
// ahead — is spatial, not a number to parse mid-performance. The on-staff colour
// shows *which* note the ghost is on; this shows the *gap*. The label carries the
// same information for assistive tech.
export function GhostTrack({ you, ghost, total }: { you: number; ghost: number; total: number }) {
    const at = (count: number) =>
        total > 0 ? Math.min(100, Math.max(0, (count / total) * 100)) : 0;
    const youAt = at(you);
    const ghostAt = at(ghost);
    const status = you > ghost ? m.ghost_ahead() : you < ghost ? m.ghost_behind() : m.ghost_tied();

    return (
        <div className="space-y-1">
            <p
                className={`text-sm font-medium ${
                    you > ghost
                        ? "text-green-700 dark:text-green-400"
                        : you < ghost
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-gray-400"
                }`}
            >
                {m.ghost_race({ ghost })} {status}
            </p>
            <div
                className="relative h-7"
                role="img"
                aria-label={m.ghost_track_label({ you, ghost, total })}
            >
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div
                    className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-indigo-500"
                    style={{ width: `${youAt}%` }}
                />
                <span
                    className="absolute top-0 -translate-x-1/2 text-base leading-none"
                    style={{ left: `${ghostAt}%` }}
                >
                    👻
                </span>
                <span
                    className="absolute bottom-0 -translate-x-1/2 text-base leading-none"
                    style={{ left: `${youAt}%` }}
                >
                    🎹
                </span>
            </div>
        </div>
    );
}
