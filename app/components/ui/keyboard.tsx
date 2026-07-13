// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type React from "react";
import { type ReactNode, useEffect, useState } from "react";
import { noteName, pitchClass } from "../../../core/midi";
import type { NoteLabels } from "../../../core/prefs";
import { BLACK_KEY, KEYBED_WELL, WHITE_KEY } from "./keyboardStyles";

const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
function isWhite(note: number): boolean {
    return WHITE_PITCH_CLASSES.includes(((note % 12) + 12) % 12);
}

// The widest a white key is allowed to grow. The keys divide the container width
// evenly (flex-1), so on a wide surface a few-key piece would otherwise stretch each
// key squat and unpiano-like. Capping the keyboard to this per white key — and
// centring it — keeps keys near the tall ~1:3 proportion of a real keyboard (the well
// is ~144px tall) however few notes a piece spans, matching the exported video's look.
// A narrow phone stays under the cap, so its keys fill the width as before.
const MAX_WHITE_KEY_PX = 44;

// The letter to print on a key, or null for none. "all" labels every key; "c" prints
// only on the C keys, the landmark that orients a beginner (the white key just left of
// each two-black-key group); "off" prints nothing.
function keyLabel(note: number, labels: NoteLabels): string | null {
    if (labels === "all") {
        return pitchClass(note);
    }
    if (labels === "c" && ((note % 12) + 12) % 12 === 0) {
        return "C";
    }
    return null;
}

const NONE: ReadonlySet<number> = new Set();

// The single on-screen piano, shared by the landing hero and every practice mode,
// so the instrument is literally the same component everywhere. Fully controlled:
// the parent says which keys are lit (held or pressed → green), which note to play
// next (expected → indigo) and the last wrong note (flashes red), and is told when
// a key goes down or up. A press held while the finger or mouse slides across the
// keybed glides note to note, each key pressed as it is entered and released as it is
// left. The hero feeds it a synth; the trainer feeds it the live MIDI/touch input.
export function Keyboard({
    from,
    to,
    lit = NONE,
    expected = [],
    wrong = null,
    rise = false,
    labels = "off",
    well = "mx-auto w-full max-w-xl",
    badge,
    onPress,
    onRelease,
}: {
    from: number;
    to: number;
    lit?: ReadonlySet<number>;
    expected?: number[];
    // Print note names on the keys for a player still learning where the notes are.
    labels?: NoteLabels;
    // The last wrong note plus a bump counter, so a repeated miss re-flashes.
    wrong?: { note: number; seq: number } | null;
    // The landing hero's one-time key-rise on load; off everywhere else.
    rise?: boolean;
    // The keybed's width and centring; defaults to a centred, capped instrument.
    well?: string;
    // An overlay pinned to the keybed's top-right corner — the MIDI-status badge. A
    // slot rather than a built-in so the bare Keyboard stays free of the MIDI context
    // (and rendarable in isolation); the wrappers that have the context pass it in.
    badge?: ReactNode;
    onPress?: (note: number) => void;
    onRelease?: (note: number) => void;
}) {
    const [flash, setFlash] = useState<number | null>(null);
    useEffect(() => {
        if (wrong == null) {
            return;
        }
        setFlash(wrong.note);
        // A cosmetic fade — the ui-is-pure rule keeps this primitive free of the
        // services context, so it owns its own transition timer (allow-listed in
        // dev/check-globals.mjs) rather than the injected Scheduler.
        const id = window.setTimeout(() => setFlash(null), 450);
        return () => window.clearTimeout(id);
    }, [wrong]);

    const notes: number[] = [];
    for (let note = from; note <= to; note++) {
        notes.push(note);
    }
    const whites = notes.filter(isWhite);
    const blacks = notes.filter((note) => !isWhite(note));
    // Guard against a range with no white keys (a degenerate single-black span):
    // dividing by zero would make every black key's left/width Infinity.
    const whiteWidth = whites.length ? 100 / whites.length : 0;
    // Cap the keyboard so keys can't stretch past a tall proportion, then centre it. The
    // black keys are positioned as a percentage of this same container, so capping the
    // container (rather than the white keys alone) keeps white and black keys aligned.
    const maxWidth = whites.length ? whites.length * MAX_WHITE_KEY_PX : undefined;

    const down = (note: number) => (event: React.PointerEvent) => {
        event.preventDefault();
        // A touch (and some pens) implicitly captures the pointer to the key it started
        // on, so a finger dragged across the keybed would keep firing on the first key
        // and never enter its neighbours. Releasing the capture lets pointerenter/leave
        // fire on each key the finger crosses, which is what turns a drag into a glide.
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onPress?.(note);
    };
    // Glide: with a button still held, sliding onto a key presses it (its neighbour is
    // released by `leave`), so dragging a finger or the mouse along the keybed runs the
    // notes in turn like a thumb dragged across a real piano.
    const enter = (note: number) => (event: React.PointerEvent) => {
        if (event.buttons !== 0) {
            onPress?.(note);
        }
    };
    // Enter/Space for keyboard players; pointer handles mouse and touch.
    const press = (note: number) => (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPress?.(note);
        }
    };
    const up = (note: number) => () => onRelease?.(note);
    // The keyup half of `press`: a key held via Enter/Space must release the note,
    // or a keyboard-only player leaves it sounding and lit until the window blurs.
    const release = (note: number) => (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
            onRelease?.(note);
        }
    };
    // Releasing on leave only while a button is held avoids stuck notes when
    // dragging across keys.
    const leave = (note: number) => (event: React.PointerEvent) => {
        if (event.buttons !== 0) {
            onRelease?.(note);
        }
    };

    const whiteState = (note: number) =>
        flash === note
            ? "bg-red-200 dark:bg-red-900"
            : lit.has(note)
              ? "translate-y-0.5 bg-green-200 shadow-[0_0_14px_-3px] shadow-green-400 dark:bg-green-900"
              : expected.includes(note)
                ? "bg-indigo-50 dark:bg-indigo-950"
                : "bg-white hover:bg-gray-50 dark:bg-gray-100";
    const blackState = (note: number) =>
        flash === note
            ? "bg-red-500"
            : lit.has(note)
              ? "translate-y-0.5 bg-green-500 shadow-[0_0_14px_-3px] shadow-green-500"
              : expected.includes(note)
                ? "bg-indigo-400"
                : "bg-gray-900 hover:bg-gray-800";

    return (
        <div className={`${KEYBED_WELL} ${well}`}>
            <div
                className="relative mx-auto h-36 w-full touch-none select-none"
                style={{ maxWidth }}
            >
                {badge}
                <div className="flex h-full w-full gap-px">
                    {whites.map((note, index) => (
                        <button
                            key={note}
                            type="button"
                            aria-label={noteName(note)}
                            onPointerDown={down(note)}
                            onPointerUp={up(note)}
                            onPointerCancel={up(note)}
                            onPointerEnter={enter(note)}
                            onPointerLeave={leave(note)}
                            onKeyDown={press(note)}
                            onKeyUp={release(note)}
                            style={rise ? { animationDelay: `${index * 45}ms` } : undefined}
                            className={`${WHITE_KEY} flex-1 ${rise ? "animate-key-rise motion-reduce:animate-none" : ""} ${whiteState(note)}`}
                        >
                            {keyLabel(note, labels) && (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-gray-400 dark:text-gray-600"
                                >
                                    {keyLabel(note, labels)}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                {blacks.map((note) => {
                    const whitesBefore = whites.filter((white) => white < note).length;
                    // A black key sits over the gap after its white neighbour. When the
                    // range begins or ends on a black key it has no neighbour on one
                    // side, so clamp it within [0, 100%] rather than hang it off the edge.
                    const width = whiteWidth * 0.6;
                    const left = Math.min(
                        Math.max(0, whitesBefore * whiteWidth - whiteWidth * 0.3),
                        100 - width,
                    );
                    return (
                        <button
                            key={note}
                            type="button"
                            aria-label={noteName(note)}
                            onPointerDown={down(note)}
                            onPointerUp={up(note)}
                            onPointerCancel={up(note)}
                            onPointerEnter={enter(note)}
                            onPointerLeave={leave(note)}
                            onKeyDown={press(note)}
                            onKeyUp={release(note)}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            className={`${BLACK_KEY} h-2/3 ${blackState(note)}`}
                        >
                            {keyLabel(note, labels) && (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-0 bottom-0.5 text-center text-[8px] font-medium leading-tight text-gray-300"
                                >
                                    {keyLabel(note, labels)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
