// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useState } from "react";
import { fingerPositions } from "../../../core/fingering";
import { barHeat } from "../../../core/fingerHeat";
import { fingerQualities } from "../../../core/fingeringScore";
import { noteName } from "../../../core/midi";
import type { MeasureBox } from "../../../core/scoreCanvas";
import { scoreToBars, staffFor, windowCells, windowPositions } from "../../../core/scoreToBars";
import { useFingeringStore, usePrefsStore, useXmlCodec } from "../../contexts/services";
import { clearBarHeat, paintBarHeat } from "../../lib/scoreColor";
import { m } from "../../paraglide/messages.js";
import { type FingerMap, fingerKey } from "../../stores/fingeringStore";
import {
    HAND_BUTTON,
    NEUTRAL,
    QUALITY_STYLE,
    QUALITY_SYMBOL,
    QUALITY_TEXT,
} from "./fingeringTrainer";

// Two bars at a time, the same window the Finger Position tab works in.
const WINDOW = 2;

type Hand = "left" | "right";

// The fullscreen fingering editor: replaces the on-screen keyboard with the piece's
// notes two bars at a time, every note pre-fingered with the optimal choice for the
// player's measured hand — tap a note, then one of the ten fingers below, and the
// override persists to the piece's saved fingering. Quality feedback (green/amber/
// red with a glyph) is always on: the point of the mode is seeing how a choice
// flows. While it's open, the score above washes its bars red by fingering
// difficulty — a heat-map of where the piece actually gets hard.
export function FingeringStrip({
    id,
    xml,
    staffCount,
    svg,
    measureBoxes,
    renderVersion,
}: {
    id: string;
    xml: string;
    staffCount: number;
    // The rendered score this strip heat-maps: the SVG (or null before render)
    // and its per-measure boxes, re-read whenever renderVersion moves.
    svg: () => SVGSVGElement | null;
    measureBoxes: () => MeasureBox[];
    renderVersion: number;
}) {
    const prefsStore = usePrefsStore();
    const xmlCodec = useXmlCodec();
    const fingering = useFingeringStore();
    const [hand, setHand] = useState<Hand>("right");
    const [start, setStart] = useState(0);
    const [map, setMap] = useState<FingerMap>(() => fingering.load(id));
    const [active, setActive] = useState(0);

    const span = prefsStore.load().handSpan[hand] ?? undefined;
    const bars = useMemo(() => scoreToBars(xmlCodec, xml, staffFor(hand)), [xmlCodec, xml, hand]);
    const lastStart = Math.max(0, bars.length - WINDOW);
    const clamped = Math.min(start, lastStart);
    const positions = useMemo(() => windowPositions(bars, clamped, WINDOW), [bars, clamped]);
    const cells = useMemo(() => windowCells(bars, clamped, WINDOW), [bars, clamped]);

    // The window's fingers: the player's saved choice where one exists, the
    // optimal fingering for their hand span everywhere else — the strip opens
    // already answered, and edits refine rather than start from blank.
    const optimal = useMemo(() => fingerPositions(positions, hand, span), [positions, hand, span]);
    const fingers = useMemo(
        () =>
            positions.map((chord, i) =>
                chord.map(
                    (_, note) =>
                        map[fingerKey(hand, cells[i]!.bar, cells[i]!.pos, note)] ??
                        optimal[i]?.[note] ??
                        null,
                ),
            ),
        [positions, cells, map, hand, optimal],
    );
    const qualities = useMemo(
        () => fingerQualities(positions, fingers, hand, span),
        [positions, fingers, hand, span],
    );

    // Every note of the window in play order, for tap-to-select and advance.
    const slots = useMemo(
        () => positions.flatMap((pos, p) => pos.map((_, note) => ({ pos: p, note }))),
        [positions],
    );
    const activeSlot = slots[Math.min(active, Math.max(0, slots.length - 1))];

    // The difficulty wash over the score: recomputed per hand and repainted onto
    // each fresh SVG (renderVersion moves when OSMD re-renders), lifted when the
    // strip leaves.
    // biome-ignore lint/correctness/useExhaustiveDependencies: renderVersion is the repaint trigger for a rebuilt SVG
    useEffect(() => {
        const target = svg();
        if (!target) {
            return;
        }
        paintBarHeat(target, measureBoxes(), barHeat(bars, hand, span));
        return () => {
            clearBarHeat(target);
        };
    }, [bars, hand, span, svg, measureBoxes, renderVersion]);

    const assign = (finger: number) => {
        const slot = activeSlot;
        const cell = slot ? cells[slot.pos] : undefined;
        if (!slot || !cell) {
            return;
        }
        // Render from the updated map either way; a refused write surfaces
        // through the layout's storage banner.
        setMap(fingering.setFinger(id, map, hand, cell.bar, cell.pos, slot.note, finger).map);
        setActive((index) => Math.min(index + 1, Math.max(0, slots.length - 1)));
    };

    const switchHand = (next: Hand) => {
        setHand(next);
        setActive(0);
    };

    // Ten fingers, laid out as two mirrored hands: left 5→1, then right 1→5.
    // Only the staff being fingered accepts input; the other hand's row is shown
    // dimmed so the layout always reads as two hands.
    const fingerRow = (rowHand: Hand) => {
        const row = rowHand === "left" ? [5, 4, 3, 2, 1] : [1, 2, 3, 4, 5];
        const enabled = rowHand === hand;
        return row.map((finger) => (
            <button
                key={`${rowHand}${finger}`}
                type="button"
                disabled={!enabled}
                onClick={() => assign(finger)}
                aria-label={`${rowHand === "left" ? m.hand_left() : m.hand_right()} — ${m.fingering_finger({ finger })}`}
                className={`h-10 w-9 rounded-md text-lg font-semibold ${
                    enabled
                        ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                        : "bg-gray-100 text-gray-300 dark:bg-gray-900 dark:text-gray-700"
                }`}
            >
                {finger}
            </button>
        ));
    };

    return (
        <div className="space-y-2 rounded-md border border-gray-200 p-2 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
                {staffCount >= 2 && (
                    <fieldset aria-label={m.hand_label()} className="flex items-center gap-1">
                        {(["right", "left"] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => switchHand(option)}
                                aria-pressed={hand === option}
                                className={HAND_BUTTON(hand === option)}
                            >
                                {option === "right" ? m.hand_right() : m.hand_left()}
                            </button>
                        ))}
                    </fieldset>
                )}
                <span className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setStart((s) => Math.max(0, Math.min(s, lastStart) - 1));
                            setActive(0);
                        }}
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
                        onClick={() => {
                            setStart((s) => Math.min(lastStart, Math.min(s, lastStart) + 1));
                            setActive(0);
                        }}
                        disabled={clamped >= lastStart}
                        aria-label={m.fingering_next_bars()}
                        className="rounded-md bg-indigo-50 px-2 py-1.5 text-sm font-medium text-indigo-700 disabled:opacity-40 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                        ›
                    </button>
                </span>
            </div>

            {positions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.fingering_empty()}</p>
            ) : (
                <div className="flex flex-wrap items-end gap-1.5">
                    {positions.map((pos, p) => (
                        <div
                            // Fixed window; the position is its identity.
                            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length window, position is identity
                            key={p}
                            className={`flex flex-col gap-0.5 rounded-md border p-1 ${
                                qualities[p] ? QUALITY_STYLE[qualities[p]!] : NEUTRAL
                            }`}
                        >
                            {qualities[p] && (
                                <span
                                    role="img"
                                    aria-label={QUALITY_SYMBOL[qualities[p]!].label()}
                                    title={QUALITY_SYMBOL[qualities[p]!].label()}
                                    className={`text-center text-xs font-bold leading-none ${QUALITY_TEXT[qualities[p]!]}`}
                                >
                                    {QUALITY_SYMBOL[qualities[p]!].glyph}
                                </span>
                            )}
                            {pos
                                .map((pitch, note) => ({ pitch, note }))
                                .reverse()
                                .map(({ pitch, note }) => {
                                    const isActive =
                                        activeSlot?.pos === p && activeSlot?.note === note;
                                    return (
                                        <button
                                            key={pitch}
                                            type="button"
                                            onClick={() =>
                                                setActive(
                                                    slots.findIndex(
                                                        (s) => s.pos === p && s.note === note,
                                                    ),
                                                )
                                            }
                                            aria-current={isActive ? "true" : undefined}
                                            className={`flex w-14 items-center justify-between rounded px-1.5 py-0.5 ${
                                                isActive
                                                    ? "bg-indigo-100 dark:bg-indigo-900"
                                                    : "bg-transparent"
                                            }`}
                                        >
                                            <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                                                {noteName(pitch)}
                                            </span>
                                            <span className="text-base font-semibold tabular-nums">
                                                {fingers[p]?.[note] ?? "·"}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <fieldset className="flex items-center gap-1" aria-label={m.hand_left()}>
                    {fingerRow("left")}
                </fieldset>
                <fieldset className="flex items-center gap-1" aria-label={m.hand_right()}>
                    {fingerRow("right")}
                </fieldset>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {m.fingering_color_legend()} {m.fingering_heat_legend()}
            </p>
        </div>
    );
}
