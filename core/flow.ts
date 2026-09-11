// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { struckGaps } from "./rhythm";
import { median } from "./stats";

// Flow measures continuity — did the player keep moving like a musician rather
// than stopping to hunt for keys? A note keeps the flow when it was cleared first
// try (no wrong note before it) AND reached without a disproportionate pause. Flow
// is the fraction of notes that do both, so a single stumble or stall costs one
// note rather than collapsing the whole score.

// One cleared note of a run: its notated onset, when it was actually played (both
// relative to the run's first note), and how many wrong notes preceded it.
// `skipped` marks a position the forgiving advance moved past: it is already a stumble
// by its wrongBefore, and its moment is the next note's, so no gap is read to or from it.
export type FlowNote = {
    targetMs: number;
    playedMs: number;
    wrongBefore: number;
    skipped?: boolean;
};

// A note reached after this many times its expected share of the run's pace counts
// as a hesitation — a stop to find the key, not a musical breath.
const HESITATION_FACTOR = 3;

// Per-note continuity. Each gap is divided by the notated gap it should fill, so
// an intentionally long note is not mistaken for a stall; a note whose ratio far
// exceeds the run's median ratio is the player dwelling well past their own pace.
// Dividing by the median makes this tempo-agnostic — playing the whole piece
// slowly but steadily flags nothing.
export function fluentNotes(notes: FlowNote[]): boolean[] {
    const ratios = struckGaps(notes).map((gap) =>
        gap && gap.notated > 0 ? gap.played / gap.notated : null,
    );
    const baseline = median(ratios.filter((ratio): ratio is number => ratio !== null && ratio > 0));
    return notes.map((note, index) => {
        if (note.wrongBefore > 0) {
            return false;
        }
        const ratio = ratios[index];
        if (ratio == null || baseline <= 0) {
            return true;
        }
        return ratio <= HESITATION_FACTOR * baseline;
    });
}

export function computeFlow(notes: FlowNote[]): number {
    if (notes.length === 0) {
        return 100;
    }
    const fluent = fluentNotes(notes).filter(Boolean).length;
    return (fluent / notes.length) * 100;
}
