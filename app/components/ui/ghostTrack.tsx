// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { GhostIcon, KeysIcon } from "./icons";

// A racer chip's classes: you in indigo, the ghost in fuchsia. The one in front glows and
// grows a touch; the one behind fades back, so the lead is legible without colour alone.
const racer = (leading: boolean, fill: string, glow: string) =>
    `flex h-6 w-6 items-center justify-center rounded-full text-white ${fill} ${
        leading ? `scale-110 ${glow}` : "opacity-60"
    }`;

// A duel read at a glance while playing: you and the ghost as two racers sharing one
// lane, each set at how far it has reached, so who leads is spatial — a gap you feel at
// a glance rather than a number to parse mid-performance. The one in front glows and
// grows; the one behind dims, so a sideways look says who's winning without reading a
// word. The on-staff colour shows *which* note the ghost is on; this shows the *gap*.
// The label carries the same standings for assistive tech.
export function GhostTrack({ you, ghost, total }: { you: number; ghost: number; total: number }) {
    const at = (count: number) =>
        total > 0 ? Math.min(100, Math.max(0, (count / total) * 100)) : 0;
    const youAt = at(you);
    const ghostAt = at(ghost);
    const youLead = you > ghost;
    const ghostLead = ghost > you;
    const status = youLead ? m.ghost_ahead() : ghostLead ? m.ghost_behind() : m.ghost_tied();

    return (
        <div className="space-y-2">
            <p
                className={`text-sm font-semibold ${
                    youLead
                        ? "text-green-700 dark:text-green-400"
                        : ghostLead
                          ? "text-fuchsia-600 dark:text-fuchsia-400"
                          : "text-gray-600 dark:text-gray-400"
                }`}
            >
                {m.ghost_race({ ghost })} {status}
            </p>
            <div
                className="relative h-12"
                role="img"
                aria-label={m.ghost_track_label({ you, ghost, total })}
            >
                {/* The shared lane, with the finish line pinned to its end. */}
                <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div
                    className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                    style={{ width: `${youAt}%` }}
                />
                <div className="absolute right-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gray-300 dark:bg-gray-500" />
                {/* The ghost rides above the lane, you below, so the two never overlap
                    even in a photo finish. */}
                <span className="absolute top-0 -translate-x-1/2" style={{ left: `${ghostAt}%` }}>
                    <span
                        className={racer(
                            ghostLead,
                            "bg-fuchsia-500",
                            "shadow-[0_0_12px_-2px] shadow-fuchsia-500",
                        )}
                    >
                        <GhostIcon className="h-3.5 w-3.5" />
                    </span>
                </span>
                <span className="absolute bottom-0 -translate-x-1/2" style={{ left: `${youAt}%` }}>
                    <span
                        className={racer(
                            youLead,
                            "bg-indigo-600",
                            "shadow-[0_0_12px_-2px] shadow-indigo-500",
                        )}
                    >
                        <KeysIcon className="h-3.5 w-3.5" />
                    </span>
                </span>
            </div>
        </div>
    );
}
