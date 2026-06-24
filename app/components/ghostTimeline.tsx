// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { plotTimeline, type TimelineNote } from "../lib/ghost";
import type { Rating } from "../lib/rhythm";
import { m } from "../paraglide/messages.js";

const FILL: Record<Rating, string> = {
    perfect: "fill-green-500",
    good: "fill-amber-500",
    off: "fill-red-500",
};

const WIDTH = 1000;
const PAD = 64;
const GHOST_Y = 22;
const YOU_Y = 52;

// Plots the player's note onsets (bottom row) against the notated "ghost" onsets
// (top row) on a shared time axis. The horizontal gap on each connector shows
// where the player rushed (left) or dragged (right); the bottom dot is coloured
// by how far it drifted. Needs at least two notes to span an axis.
export function GhostTimeline({ notes }: { notes: TimelineNote[] }) {
    if (notes.length < 2) {
        return null;
    }
    const plotted = plotTimeline(notes, WIDTH - PAD * 2);
    return (
        <figure className="space-y-1">
            <figcaption className="text-sm text-gray-500 dark:text-gray-400">
                {m.scores_timing()}
            </figcaption>
            <svg
                viewBox={`0 0 ${WIDTH} 74`}
                className="w-full"
                role="img"
                aria-label={m.scores_timing()}
            >
                <text x="0" y={GHOST_Y + 5} className="fill-gray-400 text-[18px]">
                    {m.scores_ghost()}
                </text>
                <text x="0" y={YOU_Y + 5} className="fill-gray-500 text-[18px] dark:fill-gray-400">
                    {m.scores_you()}
                </text>
                {plotted.map((note) => (
                    <line
                        key={`line-${note.ordinal}`}
                        x1={PAD + note.ghostX}
                        y1={GHOST_Y}
                        x2={PAD + note.youX}
                        y2={YOU_Y}
                        className="stroke-gray-200 dark:stroke-gray-700"
                        strokeWidth="2"
                    />
                ))}
                {plotted.map((note) => (
                    <circle
                        key={`ghost-${note.ordinal}`}
                        cx={PAD + note.ghostX}
                        cy={GHOST_Y}
                        r="6"
                        className="fill-gray-400"
                    />
                ))}
                {plotted.map((note) => (
                    <circle
                        key={`you-${note.ordinal}`}
                        cx={PAD + note.youX}
                        cy={YOU_Y}
                        r="6"
                        className={FILL[note.rating]}
                    />
                ))}
            </svg>
        </figure>
    );
}
