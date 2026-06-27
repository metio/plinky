// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo, useState } from "react";
import { scoreToBars, staffFor, windowPositions } from "../lib/scoreToBars";
import { m } from "../paraglide/messages.js";
import { FingeringDrill, HAND_BUTTON } from "./fingeringTrainer";

// Two bars at a time keeps the choice small — you don't finger a whole song at once —
// and gives enough context to reason about the next move.
const WINDOW = 2;

// Fingering practice on the open piece: pick a hand, then slide a two-bar window
// through the score and work out the fingering for each window. Reads the piece into
// per-bar positions and hands the window to the shared FingeringDrill.
export function PieceFingering({ xml }: { xml: string }) {
    const [hand, setHand] = useState<"left" | "right">("right");
    const [start, setStart] = useState(0);

    const bars = useMemo(() => scoreToBars(xml, staffFor(hand)), [xml, hand]);
    const lastStart = Math.max(0, bars.length - WINDOW);
    // A hand with fewer bars can leave start past the end; clamp for the render.
    const clamped = Math.min(start, lastStart);
    const positions = windowPositions(bars, clamped, WINDOW);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <fieldset aria-label={m.hand_label()} className="flex items-center gap-1">
                    {(["right", "left"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setHand(option)}
                            aria-pressed={hand === option}
                            className={HAND_BUTTON(hand === option)}
                        >
                            {option === "right" ? m.hand_right() : m.hand_left()}
                        </button>
                    ))}
                </fieldset>
                <span className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setStart((s) => Math.max(0, Math.min(s, lastStart) - 1))}
                        disabled={clamped <= 0}
                        aria-label={m.fingering_prev_bars()}
                        className="rounded-md bg-indigo-50 px-2 py-1.5 text-sm font-medium text-indigo-700 disabled:opacity-40 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                        ‹
                    </button>
                    <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                        {m.fingering_bars({
                            from: clamped + 1,
                            to: Math.min(clamped + WINDOW, bars.length),
                            total: bars.length,
                        })}
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            setStart((s) => Math.min(lastStart, Math.min(s, lastStart) + 1))
                        }
                        disabled={clamped >= lastStart}
                        aria-label={m.fingering_next_bars()}
                        className="rounded-md bg-indigo-50 px-2 py-1.5 text-sm font-medium text-indigo-700 disabled:opacity-40 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                        ›
                    </button>
                </span>
            </div>

            <FingeringDrill key={`${hand}-${clamped}`} positions={positions} hand={hand} />
        </div>
    );
}
