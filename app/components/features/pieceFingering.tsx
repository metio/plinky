// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo, useState } from "react";
import {
    clearSongFingering,
    type FingerMap,
    fingerKey,
    loadSongFingering,
    setFinger,
} from "../../lib/savedFingering";
import { usePrefsStore, useXmlCodec } from "../../contexts/services";
import { scoreToBars, staffFor, windowCells, windowPositions } from "../../../core/scoreToBars";
import { m } from "../../paraglide/messages.js";
import { FingeringDrill, HAND_BUTTON } from "./fingeringTrainer";
import { WindowStaff } from "./windowStaff";

// Two bars at a time keeps the choice small — you don't finger a whole song at once —
// and gives enough context to reason about the next move.
const WINDOW = 2;

// Fingering practice on the open piece: pick a hand, slide a two-bar window through the
// score, and work out the fingering for each window. What you choose is saved per song
// and pre-filled when you come back, so the work isn't lost.
export function PieceFingering({ id, xml }: { id: string; xml: string }) {
    const prefsStore = usePrefsStore();
    const xmlCodec = useXmlCodec();
    const [hand, setHand] = useState<"left" | "right">("right");
    const [start, setStart] = useState(0);
    const [map, setMap] = useState<FingerMap>(() => loadSongFingering(id));
    // Bumped on "clear" to remount the drill so it re-reads the (now empty) saved map.
    const [version, setVersion] = useState(0);
    // Live colour/symbol feedback, remembered across pieces via prefs.
    const [hints, setHints] = useState(() => prefsStore.load().fingerHints);

    const bars = useMemo(() => scoreToBars(xmlCodec, xml, staffFor(hand)), [xmlCodec, xml, hand]);
    const lastStart = Math.max(0, bars.length - WINDOW);
    // A hand with fewer bars can leave start past the end; clamp for the render.
    const clamped = Math.min(start, lastStart);
    const positions = useMemo(() => windowPositions(bars, clamped, WINDOW), [bars, clamped]);
    const cells = useMemo(() => windowCells(bars, clamped, WINDOW), [bars, clamped]);

    // Seed the drill from any fingering saved for these exact score positions.
    const initialFingers = useMemo(
        () =>
            positions.map((chord, i) =>
                chord.map((_, note) => {
                    const cell = cells[i]!;
                    return map[fingerKey(hand, cell.bar, cell.pos, note)] ?? null;
                }),
            ),
        [positions, cells, map, hand],
    );

    const hasSaved = Object.keys(map).length > 0;

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
                <button
                    type="button"
                    onClick={() =>
                        setHints((on) => {
                            const next = !on;
                            prefsStore.save({ ...prefsStore.load(), fingerHints: next });
                            return next;
                        })
                    }
                    aria-pressed={hints}
                    className={HAND_BUTTON(hints)}
                >
                    {m.fingering_hints_toggle()}
                </button>
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

            <WindowStaff
                xml={xml}
                from={clamped}
                to={clamped + WINDOW}
                label={m.window_staff_label()}
            />

            <FingeringDrill
                key={`${hand}-${clamped}-${version}`}
                positions={positions}
                hand={hand}
                hints={hints}
                initialFingers={initialFingers}
                onAssign={(pos, note, finger) => {
                    const cell = cells[pos];
                    if (cell) {
                        // Render from the updated map either way; a refused write
                        // surfaces through the layout's storage banner.
                        setMap(setFinger(id, map, hand, cell.bar, cell.pos, note, finger).map);
                    }
                }}
            />

            {hasSaved && (
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>{m.fingering_saved_hint()}</span>
                    <button
                        type="button"
                        onClick={() => {
                            clearSongFingering(id);
                            setMap({});
                            setVersion((v) => v + 1);
                        }}
                        className="text-indigo-700 underline dark:text-indigo-300"
                    >
                        {m.fingering_clear()}
                    </button>
                </div>
            )}
        </div>
    );
}
