// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { fluentNotes } from "./flow";
import { rate, type Rating } from "./rhythm";
import type { RunNote } from "./shareCard";

// Tags every note of a finished run on all three graded dimensions at once, so a
// single strip can show — per note — whether the right key was hit, how close to
// the beat it landed, and whether the player kept moving. The aggregate grade and
// the share grid summarise the same data; this keeps it note-by-note.

export type PerfNote = {
    ordinal: number;
    // Signed offset from the note's target time: negative early, positive late.
    deltaMs: number;
    // Timing band derived from |deltaMs|.
    rating: Rating;
    // The right key first try — no wrong note preceded it.
    hit: boolean;
    // Reached without a disproportionate pause.
    fluent: boolean;
};

export function performanceNotes(notes: RunNote[]): PerfNote[] {
    // Flow is judged over the whole run, then carried onto each note.
    const fluent = fluentNotes(notes);
    return notes.map((note, index) => {
        const deltaMs = note.playedMs - note.targetMs;
        return {
            ordinal: index,
            deltaMs,
            rating: rate(Math.abs(deltaMs)),
            hit: note.wrongBefore === 0,
            fluent: fluent[index] ?? true,
        };
    });
}

export type PlottedPerfNote = PerfNote & { x: number; y: number };

// A note this far off its target sits at the top (early) or bottom (late) of the
// strip; closer notes cluster around the centre line.
const FULL_MS = 200;

// Projects notes onto a [0, width] × [0, height] field: x by play order, y by how
// early or late each landed, clamped so a wild outlier stays on the strip. A note
// dead-on the beat sits on the centre line.
export function plotPerformance(
    notes: PerfNote[],
    width: number,
    height: number,
): PlottedPerfNote[] {
    const mid = height / 2;
    const step = notes.length > 1 ? width / (notes.length - 1) : 0;
    return notes.map((note, index) => {
        const offset = Math.max(-1, Math.min(1, note.deltaMs / FULL_MS));
        return { ...note, x: index * step, y: mid + offset * mid };
    });
}
