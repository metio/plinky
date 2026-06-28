// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { performanceNotes, plotPerformance } from "../lib/performance";
import { PRECISE_TOLERANCE, type Rating } from "../lib/rhythm";
import type { RunNote } from "../lib/shareCard";
import { m } from "../paraglide/messages.js";

// Each note's timing band, matched to the share emoji and the run grade.
const FILL: Record<Rating, string> = {
    perfect: "fill-green-500",
    good: "fill-amber-500",
    off: "fill-red-500",
};

const WIDTH = 1000;
const HEIGHT = 120;
const PAD = 16;

// One dot per note across a single strip: its height is how early (high) or late
// (low) it landed, its colour the timing band, a red ring marks a wrong key, and a
// dashed line marks a hesitation. The centre line is dead-on the beat. Needs at
// least two notes to span the axis.
export function PerformanceStrip({
    notes,
    tolerance = PRECISE_TOLERANCE,
}: {
    notes: RunNote[];
    tolerance?: number;
}) {
    const perf = performanceNotes(notes, tolerance);
    if (perf.length < 2) {
        return null;
    }
    const plotted = plotPerformance(perf, WIDTH - PAD * 2, HEIGHT - PAD * 2);
    const mid = HEIGHT / 2;
    return (
        <figure className="space-y-1">
            <figcaption className="text-sm text-gray-500 dark:text-gray-400">
                {m.perf_heading()}
            </figcaption>
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full"
                role="img"
                aria-label={m.perf_label()}
            >
                <line
                    x1={PAD}
                    y1={mid}
                    x2={WIDTH - PAD}
                    y2={mid}
                    className="stroke-gray-200 dark:stroke-gray-700"
                    strokeWidth="2"
                />
                {plotted.map((note) => {
                    const x = PAD + note.x;
                    const y = PAD + note.y;
                    return (
                        <g key={note.ordinal}>
                            {!note.fluent && (
                                <line
                                    x1={x}
                                    y1={PAD}
                                    x2={x}
                                    y2={HEIGHT - PAD}
                                    className="stroke-amber-400"
                                    strokeWidth="2"
                                    strokeDasharray="3 4"
                                />
                            )}
                            <circle cx={x} cy={y} r="5" className={FILL[note.rating]} />
                            {!note.hit && (
                                <circle
                                    cx={x}
                                    cy={y}
                                    r="9"
                                    fill="none"
                                    className="stroke-red-500"
                                    strokeWidth="2"
                                />
                            )}
                        </g>
                    );
                })}
            </svg>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{m.perf_legend_timing()}</span>
                <span>{m.perf_legend_accuracy()}</span>
                <span>{m.perf_legend_flow()}</span>
            </div>
        </figure>
    );
}
