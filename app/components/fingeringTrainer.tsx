// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "./button";
import { Show } from "./conditional";
import { useSynth } from "../hooks/useSynth";
import { drillToMusicXml } from "../../core/drillStaff";
import {
    type FingerQuality,
    type FingerReason,
    type FingeringResult,
    fingerQualities,
    reasonFor,
    scoreFingering,
} from "../../core/fingeringScore";
import { GRADE_COLOR, type Letter } from "../../core/grade";
import { noteName } from "../../core/midi";
import { usePrefsStore } from "../contexts/services";
import { m } from "../paraglide/messages.js";
import { StaffPreview } from "./staffPreview";

const FINGERS = [1, 2, 3, 4, 5];

// The plain-language reason behind each flagged position.
const REASON: Record<FingerReason, () => string> = {
    thumbBlack: m.fingering_reason_thumbBlack,
    repeat: m.fingering_reason_repeat,
    general: m.fingering_reason_general,
};

// One note awaiting a finger: which position it's in and its index within it.
type Slot = { pos: number; note: number };

// Gentle per-position colours for the live feedback — informative, never alarming.
const QUALITY_STYLE: Record<FingerQuality, string> = {
    good: "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/40",
    ok: "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40",
    bad: "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/40",
};

// A glyph per verdict so the feedback doesn't rely on colour alone — readable to a
// colour-blind player, and a label for assistive tech.
const QUALITY_SYMBOL: Record<FingerQuality, { glyph: string; label: () => string }> = {
    good: { glyph: "✓", label: () => m.fingering_quality_good() },
    ok: { glyph: "≈", label: () => m.fingering_quality_ok() },
    bad: { glyph: "!", label: () => m.fingering_quality_bad() },
};
const QUALITY_TEXT: Record<FingerQuality, string> = {
    good: "text-green-700 dark:text-green-300",
    ok: "text-amber-700 dark:text-amber-300",
    bad: "text-red-700 dark:text-red-300",
};
const NEUTRAL = "border-gray-200 dark:border-gray-800";

// A self-paced grade for the fingering's smoothness, reusing the run grade's
// letters and colours so the feedback reads like the rest of the app.
function letterFor(efficiency: number): Letter {
    if (efficiency >= 0.97) return "S";
    if (efficiency >= 0.9) return "A";
    if (efficiency >= 0.8) return "B";
    if (efficiency >= 0.65) return "C";
    return "D";
}

// Choose a finger for every note of a fixed line of positions, then score the choice
// by playing effort against a comfortable fingering. Self-contained: it owns its
// fingers/active/result, so the caller just hands it positions and a hand and remounts
// it (via key) to start a fresh line. Shared by the standalone drill and the per-piece
// fingering mode.
export function FingeringDrill({
    positions,
    hand,
    initialFingers,
    onAssign,
    hints = true,
}: {
    positions: number[][];
    hand: "left" | "right";
    // Pre-filled fingers (e.g. ones saved for this passage), and a callback fired for
    // each choice so the caller can persist it. Both optional — the standalone drill
    // starts blank and saves nothing.
    initialFingers?: (number | null)[][];
    onAssign?: (pos: number, note: number, finger: number) => void;
    // Live per-note feedback as you go. Off leaves the line plain until you check it,
    // for a learner building their own judgement.
    hints?: boolean;
}) {
    const prefsStore = usePrefsStore();
    const synth = useSynth();
    const [fingers, setFingers] = useState<(number | null)[][]>(
        () => initialFingers ?? positions.map((pos) => pos.map(() => null)),
    );
    const [active, setActive] = useState(0);
    const [result, setResult] = useState<FingeringResult | null>(null);

    // Every note across the line, low to high within each position, in play order.
    const slots = useMemo<Slot[]>(
        () => positions.flatMap((pos, p) => pos.map((_, note) => ({ pos: p, note }))),
        [positions],
    );

    // The line rendered on a staff, so the player reads real notation rather than only
    // note names — the skill that transfers to a real score.
    const staffXml = useMemo(
        () => (positions.length > 0 ? drillToMusicXml(positions, hand) : null),
        [positions, hand],
    );

    // Per-position verdict that colours each note as it's fingered — live feedback,
    // recomputed whenever a choice changes. Empty when hints are faded off.
    const qualities = useMemo(
        () =>
            hints
                ? fingerQualities(
                      positions,
                      fingers,
                      hand,
                      prefsStore.load().handSpan[hand] ?? undefined,
                  )
                : positions.map(() => null),
        [positions, fingers, hand, hints, prefsStore.load],
    );

    const assign = useCallback(
        (finger: number) => {
            if (result) {
                return;
            }
            const slot = slots[active];
            if (!slot) {
                return;
            }
            const next = fingers.map((tuple, p) =>
                p === slot.pos ? tuple.map((f, n) => (n === slot.note ? finger : f)) : tuple,
            );
            setFingers(next);
            onAssign?.(slot.pos, slot.note, finger);
            // Once every note of the chord has a finger, sound it — hearing what you
            // just fingered ties the choice to the music. The synth honours the global
            // sound preference, so there's no separate toggle to bury.
            const chord = positions[slot.pos];
            if (chord && next[slot.pos]?.every((f) => f !== null)) {
                for (const pitch of chord) {
                    synth.playNote(pitch);
                }
            }
            setActive((index) => Math.min(index + 1, slots.length - 1));
        },
        [active, slots, result, fingers, positions, synth, onAssign],
    );

    // Number keys 1–5 assign a finger to the highlighted note, like the buttons.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const finger = Number(event.key);
            if (finger >= 1 && finger <= 5) {
                assign(finger);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [assign]);

    if (positions.length === 0) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">{m.fingering_empty()}</p>;
    }

    const complete = fingers.length > 0 && fingers.every((tuple) => tuple.every((f) => f !== null));
    const check = () => {
        if (complete) {
            const span = prefsStore.load().handSpan[hand] ?? undefined;
            setResult(scoreFingering(positions, fingers as number[][], hand, span));
        }
    };
    const activeSlot = result ? null : slots[active];

    return (
        <div className="space-y-5">
            {staffXml && <StaffPreview xml={staffXml} label={m.fingering_staff_label()} />}

            {/* Each position is a column; a chord stacks its notes, highest on top. */}
            <div className="flex flex-wrap items-end gap-2">
                {positions.map((pos, p) => (
                    <div
                        // The line never reorders within a run, so the position is a stable key.
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length line, position is identity
                        key={p}
                        className={`flex flex-col gap-1 rounded-md border p-1 ${
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
                                const chosen = fingers[p]?.[note];
                                const isActive = activeSlot?.pos === p && activeSlot?.note === note;
                                return (
                                    <button
                                        key={pitch}
                                        type="button"
                                        onClick={() =>
                                            !result &&
                                            setActive(
                                                slots.findIndex(
                                                    (s) => s.pos === p && s.note === note,
                                                ),
                                            )
                                        }
                                        aria-current={isActive ? "true" : undefined}
                                        className={`flex w-14 items-center justify-between rounded px-2 py-1 ${
                                            isActive
                                                ? "bg-indigo-100 dark:bg-indigo-900"
                                                : "bg-transparent"
                                        }`}
                                    >
                                        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                                            {noteName(pitch)}
                                        </span>
                                        <span className="text-base font-semibold tabular-nums">
                                            {chosen ?? "·"}
                                        </span>
                                        {result && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {result.suggested[p]?.[note]}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                ))}
            </div>

            <Show when={hints}>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {m.fingering_color_legend()}
                </p>
            </Show>

            {result ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-4 rounded-md border border-gray-200 p-3 dark:border-gray-800">
                        <div
                            className={`text-5xl font-bold leading-none ${GRADE_COLOR[letterFor(result.efficiency)]}`}
                        >
                            {letterFor(result.efficiency)}
                        </div>
                        <div className="space-y-1 text-sm">
                            <p className="font-medium">
                                {m.fingering_smoothness({
                                    percent: Math.round(result.efficiency * 100),
                                })}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                                {result.reconsider.length === 0
                                    ? m.fingering_comfortable()
                                    : m.fingering_reconsider()}
                            </p>
                            <Show when={result.reconsider.length > 0}>
                                <ul className="list-disc space-y-0.5 pl-4 text-gray-600 dark:text-gray-400">
                                    {result.reconsider.map((index) => {
                                        const pos = positions[index]!;
                                        return (
                                            <li key={index}>
                                                {noteName(pos[pos.length - 1]!)} —{" "}
                                                {REASON[
                                                    reasonFor(
                                                        positions,
                                                        fingers as number[][],
                                                        index,
                                                        hand,
                                                    )
                                                ]()}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Show>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {m.fingering_legend()}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{m.fingering_hint()}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {FINGERS.map((finger) => (
                            <button
                                key={finger}
                                type="button"
                                onClick={() => assign(finger)}
                                aria-label={m.fingering_finger({ finger })}
                                className="h-10 w-10 rounded-md bg-indigo-50 text-lg font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                            >
                                {finger}
                            </button>
                        ))}
                        <Button
                            variant="primary"
                            onClick={check}
                            disabled={!complete}
                            className="ml-2"
                        >
                            {m.fingering_check()}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// The hand-toggle button style, shared with the per-piece fingering mode.
export const HAND_BUTTON = (selected: boolean) =>
    selected
        ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        : "rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300";
