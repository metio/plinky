// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { combinedScore, computeSegments, type RunNote, SEGMENTS, type ShareOptions } from "./shareCard";

// Your best reading of a piece, assembled section by section.
//
// A grade describes one run: play the first half beautifully and fumble the coda and
// the number says "good, not great", the same as it did last week when you fumbled
// the opening instead. The improvement is real and invisible.
//
// This keeps the best you have ever played each section of a piece, and totals
// those. The headline can only go up, and it goes up whenever any part of the piece
// gets better — which is what practising a piece actually feels like from inside.

// Sections are the share card's segments, so the six moments a player already sees
// in their grid are the six this measures. One segmentation, one meaning.
export const SECTIONS = SEGMENTS;

// One run's sections, each 0–100. A section is scored by its weakest aspect, exactly
// as the share grid scores it: a moment is only as good as its shakiest part.
export function sectionScores(notes: RunNote[], options: ShareOptions = {}): number[] {
    return computeSegments(notes, SECTIONS, options).map((metrics) =>
        Math.round(combinedScore(metrics) * 100),
    );
}

// Fold a run into the record: each section keeps whichever reading went better.
// A first run simply becomes the record.
export function mergeBest(previous: number[] | null, run: number[]): number[] {
    return Array.from({ length: SECTIONS }, (_, index) =>
        Math.max(previous?.[index] ?? 0, run[index] ?? 0),
    );
}

// The headline: the average of the best each section has ever been. Not a run you
// ever played in one sitting, and not pretending to be — it is what the piece sounds
// like when every part goes as well as it already has.
export function bestTotal(best: number[]): number {
    if (best.length === 0) {
        return 0;
    }
    return Math.round(best.reduce((sum, score) => sum + score, 0) / best.length);
}

// Which sections this run beat, so the player can be told what actually improved
// rather than only that the number moved.
export function improvedSections(previous: number[] | null, run: number[]): number[] {
    const improved: number[] = [];
    run.forEach((score, index) => {
        if (score > (previous?.[index] ?? 0)) {
            improved.push(index);
        }
    });
    return improved;
}

// Coerce a stored record into a usable one. A record of the wrong length would
// silently drop or invent sections, so it is rebuilt to the right shape.
export function normalizeBest(raw: unknown): number[] | null {
    if (!Array.isArray(raw)) {
        return null;
    }
    const scores = Array.from({ length: SECTIONS }, (_, index) => {
        const value = raw[index];
        return typeof value === "number" && Number.isFinite(value)
            ? Math.min(100, Math.max(0, Math.round(value)))
            : 0;
    });
    // An all-zero record says nothing and would render as a real result of zero.
    return scores.some((score) => score > 0) ? scores : null;
}
