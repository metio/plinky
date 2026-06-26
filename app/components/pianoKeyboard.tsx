// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMidiConnection } from "../contexts/midi";
import { noteName } from "../lib/midi";
import { BLACK_KEY, KEYBED_WELL, WHITE_KEY } from "./keyboardStyles";

// Pitch classes of the white keys; everything else is a black key.
const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];

function isWhite(note: number): boolean {
    return WHITE_PITCH_CLASSES.includes(((note % 12) + 12) % 12);
}

// A tappable on-screen piano. It feeds the same input funnel as a MIDI device, so
// it works as an input on touch devices, and highlights the note(s) to play next.
export function PianoKeyboard({
    expected = [],
    from = 60,
    to = 84,
    fingers = {},
}: {
    expected?: number[];
    from?: number;
    to?: number;
    // Suggested finger (1–5) per pitch, shown on the key it belongs to.
    fingers?: Record<number, number>;
}) {
    const { heldNotes, pressKey, releaseKey } = useMidiConnection();

    const notes: number[] = [];
    for (let note = from; note <= to; note++) {
        notes.push(note);
    }
    const whites = notes.filter(isWhite);
    const blacks = notes.filter((note) => !isWhite(note));
    // Guard against a range with no white keys (a degenerate single-black span):
    // dividing by zero would make every black key's left/width Infinity.
    const whiteWidth = whites.length ? 100 / whites.length : 0;

    const down = (note: number) => (event: React.PointerEvent) => {
        event.preventDefault();
        pressKey(note);
    };
    const up = (note: number) => () => releaseKey(note);
    // Releasing on leave only when a button is still held avoids stuck notes when
    // dragging across keys.
    const leave = (note: number) => (event: React.PointerEvent) => {
        if (event.buttons !== 0) {
            releaseKey(note);
        }
    };

    return (
        <div className={`w-full ${KEYBED_WELL}`}>
            <div className="relative h-28 w-full touch-none select-none">
                <div className="flex h-full w-full gap-px">
                    {whites.map((note) => (
                        <button
                            key={note}
                            type="button"
                            aria-label={noteName(note)}
                            onPointerDown={down(note)}
                            onPointerUp={up(note)}
                            onPointerCancel={up(note)}
                            onPointerLeave={leave(note)}
                            className={`${WHITE_KEY} flex-1 ${
                                heldNotes.includes(note)
                                    ? "translate-y-0.5 bg-green-200 shadow-[0_0_14px_-3px] shadow-green-400 dark:bg-green-900"
                                    : expected.includes(note)
                                      ? "bg-indigo-50 dark:bg-indigo-950"
                                      : "bg-white hover:bg-gray-50 dark:bg-gray-100"
                            }`}
                        >
                            {fingers[note] ? (
                                <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                    {fingers[note]}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
                {blacks.map((note) => {
                    const whitesBefore = whites.filter((white) => white < note).length;
                    // A black key sits over the gap after its white neighbour. When the
                    // range begins or ends on a black key it has no neighbour on one
                    // side, so clamp it within [0, 100%] rather than letting it hang off
                    // the edge.
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
                            onPointerLeave={leave(note)}
                            className={`${BLACK_KEY} h-2/3 ${
                                heldNotes.includes(note)
                                    ? "translate-y-0.5 bg-green-500 shadow-[0_0_14px_-3px] shadow-green-500"
                                    : expected.includes(note)
                                      ? "bg-indigo-400"
                                      : "bg-gray-900 hover:bg-gray-800"
                            }`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                        >
                            {fingers[note] ? (
                                <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] font-semibold text-white">
                                    {fingers[note]}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
