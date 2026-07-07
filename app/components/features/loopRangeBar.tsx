// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Dispatch, SetStateAction } from "react";
import { m } from "../../paraglide/messages.js";

// A typed bar number for the loop range — a number field (not a stepper), because a
// piece can run to many bars and typing the target beats tapping a stepper there.
const NUMBER_INPUT =
    "w-14 rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300";

// The active loop's range and narrowing controls, sitting right by the score — the
// practice-tools drawer's backdrop covers the score, so narrowing happens here, drawer
// closed: tap two bars on the score, or type the first and last bar. The number inputs
// are the keyboard-accessible path, and they keep the range honest: the start drags the
// end along so from can never pass to.
export function LoopRangeBar({
    measureCount,
    from,
    to,
    setFrom,
    setTo,
    onWholeSong,
}: {
    measureCount: number;
    from: number;
    to: number;
    setFrom: Dispatch<SetStateAction<number>>;
    setTo: Dispatch<SetStateAction<number>>;
    // Reset the range to the whole song — also dropping any half-made click selection.
    onWholeSong: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium text-red-600 dark:text-red-400">
                🔁 {m.loop_section()}
            </span>
            {from === 1 && to === measureCount ? (
                <span className="text-gray-500 dark:text-gray-400">{m.loop_hint_narrow()}</span>
            ) : (
                <button
                    type="button"
                    onClick={onWholeSong}
                    className="min-h-11 text-indigo-700 hover:underline dark:text-indigo-300"
                >
                    {m.loop_whole_song()}
                </button>
            )}
            <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                <input
                    type="number"
                    min={1}
                    max={measureCount}
                    value={from}
                    onChange={(event) => {
                        const value = Math.min(
                            Math.max(Number(event.target.value), 1),
                            measureCount,
                        );
                        setFrom(value);
                        // The start can't pass the end — drag the end along so the
                        // range never inverts.
                        setTo((current) => Math.max(current, value));
                    }}
                    aria-label={m.loop_from()}
                    className={NUMBER_INPUT}
                />
                <span aria-hidden="true">–</span>
                <input
                    type="number"
                    min={from}
                    max={measureCount}
                    value={to}
                    onChange={(event) =>
                        setTo(Math.min(Math.max(Number(event.target.value), from), measureCount))
                    }
                    aria-label={m.loop_to()}
                    className={NUMBER_INPUT}
                />
            </span>
        </div>
    );
}
