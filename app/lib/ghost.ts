// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { rate, type Rating } from "./rhythm";

// One note on the timing timeline: where it should have sounded (targetMs, the
// "ghost") and where the player actually played it (playedMs), both in ms from
// the first note of the run.
export type TimelineNote = { ordinal: number; targetMs: number; playedMs: number };

export type PlottedNote = {
    ordinal: number;
    ghostX: number;
    youX: number;
    rating: Rating;
    deltaMs: number;
};

// Projects the timeline onto a [0, width] axis: the ghost at its notated time,
// the player's note at theirs (clamped into range), coloured by how far it
// drifted. The horizontal gap between the two is the visible drift.
export function plotTimeline(notes: TimelineNote[], width: number): PlottedNote[] {
    const maxMs = Math.max(1, ...notes.flatMap((note) => [note.targetMs, note.playedMs]));
    return notes.map((note) => {
        const deltaMs = note.playedMs - note.targetMs;
        const clamped = Math.max(0, Math.min(maxMs, note.playedMs));
        return {
            ordinal: note.ordinal,
            ghostX: (note.targetMs / maxMs) * width,
            youX: (clamped / maxMs) * width,
            rating: rate(Math.abs(deltaMs)),
            deltaMs,
        };
    });
}
