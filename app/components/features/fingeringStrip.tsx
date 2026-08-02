// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useState } from "react";
import { fingerPositions } from "../../../core/fingering";
import { barHeat } from "../../../core/fingerHeat";
import { fingerQualities } from "../../../core/fingeringScore";
import { noteName } from "../../../core/midi";
import type { MeasureBox } from "../../../core/scoreCanvas";
import { scoreToBars, staffFor } from "../../../core/scoreToBars";
import { useFingeringStore, usePrefsStore, useXmlCodec } from "../../contexts/services";
import { clearBarHeat, paintBarHeat } from "../../lib/scoreColor";
import { m } from "../../paraglide/messages.js";
import { useBarWindow } from "../../hooks/useBarWindow";
import { type FingerMap, fingerKey } from "../../stores/fingeringStore";

import type { FingerQuality } from "../../../core/fingeringScore";

// Gentle per-position colours for the live feedback — informative, never
// alarming — each paired with a glyph so the verdict doesn't rely on colour
// alone (readable to a colour-blind player, and a label for assistive tech).
const QUALITY_STYLE: Record<FingerQuality, string> = {
    good: "border-success-line bg-success-surface dark:bg-success-surface/40",
    ok: "border-warn-line bg-warn-surface dark:bg-warn-surface/40",
    bad: "border-danger-line bg-danger-surface dark:bg-danger-surface/40",
};
const QUALITY_SYMBOL: Record<FingerQuality, { glyph: string; label: () => string }> = {
    good: { glyph: "✓", label: () => m.fingering_quality_good() },
    ok: { glyph: "≈", label: () => m.fingering_quality_ok() },
    bad: { glyph: "!", label: () => m.fingering_quality_bad() },
};
const QUALITY_TEXT: Record<FingerQuality, string> = {
    good: "text-success",
    ok: "text-warn",
    bad: "text-danger-strong",
};
const NEUTRAL = "border-line";

// The hand-toggle button style.
const HAND_BUTTON = (selected: boolean) =>
    selected
        ? "rounded-md bg-accent-solid px-3 py-1.5 text-sm font-medium text-white"
        : "rounded-md bg-accent-surface px-3 py-1.5 text-sm font-medium text-accent-strong hover:bg-accent-fill";

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
    const [map, setMap] = useState<FingerMap>(() => fingering.load(id));
    const [active, setActive] = useState(0);

    const span = prefsStore.load().handSpan[hand] ?? undefined;
    const bars = useMemo(() => scoreToBars(xmlCodec, xml, staffFor(hand)), [xmlCodec, xml, hand]);
    const window = useBarWindow(bars, WINDOW);
    const { positions, cells } = window;

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
                        ? "bg-accent-surface text-accent-strong hover:bg-accent-fill"
                        : "bg-subtle text-ink-disabled"
                }`}
            >
                {finger}
            </button>
        ));
    };

    return (
        <div className="mx-auto w-full max-w-3xl space-y-2 rounded-md border border-line p-2">
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
                            window.prev();
                            setActive(0);
                        }}
                        disabled={!window.canPrev}
                        aria-label={m.fingering_prev_bars()}
                        className="rounded-md bg-accent-surface px-2 py-1.5 text-sm font-medium text-accent-strong disabled:opacity-40"
                    >
                        ‹
                    </button>
                    <span className="text-sm tabular-nums text-muted">
                        {m.fingering_bars({
                            from: window.start + 1,
                            to: window.end,
                            total: bars.length,
                        })}
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            window.next();
                            setActive(0);
                        }}
                        disabled={!window.canNext}
                        aria-label={m.fingering_next_bars()}
                        className="rounded-md bg-accent-surface px-2 py-1.5 text-sm font-medium text-accent-strong disabled:opacity-40"
                    >
                        ›
                    </button>
                </span>
            </div>

            {positions.length === 0 ? (
                <p className="text-sm text-muted">{m.fingering_empty()}</p>
            ) : (
                <div className="flex flex-wrap items-end justify-center gap-1.5">
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
                                                isActive ? "bg-accent-fill" : "bg-transparent"
                                            }`}
                                        >
                                            <span className="font-mono text-xs text-body">
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

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <fieldset className="flex items-center gap-1" aria-label={m.hand_left()}>
                    {fingerRow("left")}
                </fieldset>
                <fieldset className="flex items-center gap-1" aria-label={m.hand_right()}>
                    {fingerRow("right")}
                </fieldset>
            </div>
            <p className="text-xs text-muted">
                {m.fingering_color_legend()} {m.fingering_heat_legend()}
            </p>
        </div>
    );
}
