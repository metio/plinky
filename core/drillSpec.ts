// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {
    DRILL_RHYTHMS,
    type DrillOptions,
    HIGHEST_MIDI,
    LOWEST_MIDI,
    MAX_FIFTHS,
    MIN_FIFTHS,
} from "./drill";

// What a reader can shape about a drill, described once. The panel renders from
// this list rather than hand-wiring a control per option, so adding a knob is
// adding an entry — and the labels, bounds and defaults cannot drift apart from
// what the generator actually accepts.

export type DrillField =
    // A number picked from a bounded run, rendered as a stepper.
    | { id: NumericField; kind: "number"; min: number; max: number }
    // One of a fixed set, rendered as a segmented choice.
    | { id: "rhythm"; kind: "choice"; options: readonly string[] }
    | { id: "hands"; kind: "choice"; options: readonly string[] }
    // A pair of MIDI bounds picked together.
    | { id: "range"; kind: "range"; min: number; max: number }
    | { id: "chromatic"; kind: "switch" };

type NumericField = "bars" | "fifths" | "notesPerColumn" | "maxLeap" | "smoothness";

export const DRILL_FIELDS: readonly DrillField[] = [
    { id: "bars", kind: "number", min: 1, max: 32 },
    { id: "fifths", kind: "number", min: MIN_FIFTHS, max: MAX_FIFTHS },
    { id: "chromatic", kind: "switch" },
    { id: "range", kind: "range", min: LOWEST_MIDI, max: HIGHEST_MIDI },
    { id: "hands", kind: "choice", options: ["1", "2"] },
    { id: "notesPerColumn", kind: "number", min: 1, max: 4 },
    { id: "rhythm", kind: "choice", options: DRILL_RHYTHMS },
    { id: "maxLeap", kind: "number", min: 0, max: 24 },
    { id: "smoothness", kind: "number", min: 0, max: 6 },
];

// The major key a signature spells, for naming a choice the reader recognises —
// nobody picks "three sharps", they pick A major.
const MAJOR_KEYS = [
    "Cb",
    "Gb",
    "Db",
    "Ab",
    "Eb",
    "Bb",
    "F",
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "C#",
];

export function keyName(fifths: number): string {
    return MAJOR_KEYS[fifths - MIN_FIFTHS] ?? "C";
}

// A drill with every value forced back inside what the generator can use: the
// fields above bound the UI, and this bounds everything else — a restored preset,
// a hand-edited link, a stored setup from an older build.
export function clampDrill(options: DrillOptions): DrillOptions {
    const bound = (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));
    const low = bound(options.low, LOWEST_MIDI, HIGHEST_MIDI);
    const high = bound(options.high, LOWEST_MIDI, HIGHEST_MIDI);
    return {
        ...options,
        bars: bound(options.bars, 1, 32),
        beatsPerBar: bound(options.beatsPerBar, 2, 12),
        hands: options.hands === 2 ? 2 : 1,
        fifths: bound(options.fifths, MIN_FIFTHS, MAX_FIFTHS),
        chromatic: options.chromatic === true,
        // A range names a span whichever way round it was given.
        low: Math.min(low, high),
        high: Math.max(low, high),
        notesPerColumn: bound(options.notesPerColumn, 1, 4),
        maxLeap: bound(options.maxLeap, 0, 24),
        rhythm: DRILL_RHYTHMS.includes(options.rhythm) ? options.rhythm : "quarters",
        smoothness: bound(options.smoothness, 0, 6),
    };
}
