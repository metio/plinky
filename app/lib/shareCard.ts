// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { fluentNotes } from "./flow";
import { type Letter, letterFor } from "./grade";
import { PRECISE_TOLERANCE, timingDeltas } from "./rhythm";

// Compiles a finished run into a Wordle-style share artifact: the run is sliced
// into six moments and scored on the three shareable dimensions — Accuracy,
// Timing, Flow — each landing in one of five colour bands. The result is a 3×6 grid
// rendered as an emoji block (text share) or an SVG card (image share). The grid
// deliberately carries no numbers or labels: the shape is the thing people share.
// Five bands (not three) so runs produce visibly different grids rather than a wall
// of one colour, and they are the same A–F scale the run's grade uses, so a green
// cell means the same "this was an A" as the grade letter does.

// One cleared note of a run, relative to the run's first note: its notated onset
// (the ideal), when it was actually played, and how many wrong notes preceded it.
export type RunNote = {
    targetMs: number;
    playedMs: number;
    wrongBefore: number;
};

// A run note tagged with whether it kept the flow and its timing deviation from the
// player's own pace — both decided once over the whole run, not a six-note slice, so
// hesitation and rhythm are judged against the player's overall tempo.
type ScoredNote = RunNote & { fluent: boolean; timingDelta: number };

// The three dimensions, in the order they appear as grid rows.
export type Dimension = "accuracy" | "timing" | "flow";
export const DIMENSIONS: Dimension[] = ["accuracy", "timing", "flow"];

export type SegmentMetrics = Record<Dimension, number>; // each 0..1

// Five bands, best → worst, shared by the emoji block, the SVG card and the in-app grid.
export type Level = "best" | "good" | "ok" | "weak" | "none";
export type Grid = Level[][]; // [dimension][segment]

// The number of moments a run is split into — the columns of the grid.
export const SEGMENTS = 6;

// A note this many milliseconds off the player's own pace scores zero on timing;
// dead-on scores one, with a linear ramp between. Widened for imprecise input (see
// the tolerance passed through from the run's grade).
const TIMING_ZERO_MS = 200;

// The seven grade letters collapsed onto five colour bands. Going through letterFor
// is the single source of truth: a cell's 0..1 dimension score is banded on exactly
// the A–F scale the overall grade uses, so the colours can't drift from the grade.
const LETTER_BAND: Record<Letter, Level> = {
    S: "best",
    A: "best",
    B: "good",
    C: "ok",
    D: "weak",
    E: "none",
    F: "none",
};

export function levelFor(value: number): Level {
    return LETTER_BAND[letterFor(value * 100)];
}

// Scores one segment's notes on each dimension. An empty segment (a piece with
// fewer notes than segments, or one abandoned early) scores zero everywhere.
function metricsFor(notes: ScoredNote[], tolerance: number): SegmentMetrics {
    if (notes.length === 0) {
        return { accuracy: 0, timing: 0, flow: 0 };
    }
    const wrong = notes.reduce((sum, note) => sum + note.wrongBefore, 0);
    const fluent = notes.filter((note) => note.fluent).length;
    const zero = TIMING_ZERO_MS * tolerance;
    const timing = notes.reduce((sum, note) => {
        const off = Math.min(1, Math.abs(note.timingDelta) / zero);
        return sum + (1 - off);
    }, 0);
    return {
        accuracy: notes.length / (notes.length + wrong),
        timing: timing / notes.length,
        flow: fluent / notes.length,
    };
}

// Splits the run into SEGMENTS contiguous, proportional slices by note order, so
// the grid reads the same whatever the piece's length or tempo, and scores each.
// Flow and the timing deviations are decided over the whole run first, then carried
// into the slices. The tolerance widens the timing window for imprecise input.
export function computeSegments(
    notes: RunNote[],
    count = SEGMENTS,
    tolerance = PRECISE_TOLERANCE,
): SegmentMetrics[] {
    const fluent = fluentNotes(notes);
    const deltas = timingDeltas(notes);
    const buckets: ScoredNote[][] = Array.from({ length: count }, () => []);
    notes.forEach((note, index) => {
        const slice = Math.min(count - 1, Math.floor((index * count) / notes.length));
        buckets[slice]?.push({
            ...note,
            fluent: fluent[index] ?? false,
            timingDelta: deltas[index] ?? 0,
        });
    });
    return buckets.map((bucket) => metricsFor(bucket, tolerance));
}

// One row per dimension, one column per segment.
export function toGrid(segments: SegmentMetrics[]): Grid {
    return DIMENSIONS.map((dimension) => segments.map((segment) => levelFor(segment[dimension])));
}

export function gridFor(notes: RunNote[], tolerance = PRECISE_TOLERANCE): Grid {
    return toGrid(computeSegments(notes, SEGMENTS, tolerance));
}

// A green → red quality ramp, with ⬜ for the bottom band (a Wordle-style "absent").
const EMOJI: Record<Level, string> = {
    best: "🟩",
    good: "🟨",
    ok: "🟧",
    weak: "🟥",
    none: "⬜",
};

// One glyph per row, in DIMENSIONS order, as a tiny legend on the shared artifacts
// (a target for accuracy, a stopwatch for timing, notes for flow). Just enough key
// that a recipient who's never seen Plinky can read the grid, without spelling it out
// in words or numbers — the in-app card already carries text labels, so this is only
// for the shared text and image.
const ROW_BADGES = ["🎯", "⏱️", "🎶"];

export function gridEmoji(grid: Grid): string {
    return grid
        .map((row, r) => `${ROW_BADGES[r] ?? ""} ${row.map((level) => EMOJI[level]).join("")}`)
        .join("\n");
}

// The clipboard/social text: a one-line boast and the emoji grid, with no link —
// so a shared run reads as a player's own brag, not an ad. Attribution lives on
// the image card, where a small footer reads as a credit rather than a promotion.
export function shareText(boast: string, grid: Grid): string {
    return `${boast}\n${gridEmoji(grid)}`;
}

// Image-share colours, matched to the in-app band emoji on a dark card.
const FILL: Record<Level, string> = {
    best: "#22c55e",
    good: "#eab308",
    ok: "#f97316",
    weak: "#ef4444",
    none: "#374151",
};

// A 1080×1350 dark portrait card — the shape sized for a social feed. Pure markup
// so it can be tested and rasterised to PNG in the browser without a DOM.
export function svgCard(grid: Grid, heading: string): string {
    const width = 1080;
    const height = 1350;
    const cols = grid[0]?.length ?? SEGMENTS;
    const rows = grid.length;
    const gap = 28;
    const cell = 132;
    // A gutter on the left holds each row's legend glyph; the gutter + grid centre as
    // one block, so the card stays balanced.
    const badgeW = 110;
    const gridW = cols * cell + (cols - 1) * gap;
    const gridH = rows * cell + (rows - 1) * gap;
    const blockLeft = (width - (badgeW + gridW)) / 2;
    const gridLeft = blockLeft + badgeW;
    const top = (height - gridH) / 2;
    const cells = grid
        .flatMap((row, r) =>
            row.map((level, c) => {
                const x = gridLeft + c * (cell + gap);
                const y = top + r * (cell + gap);
                return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="20" fill="${FILL[level]}"/>`;
            }),
        )
        .join("");
    const badges = grid
        .map(
            (_, r) =>
                `<text x="${blockLeft + badgeW / 2}" y="${top + r * (cell + gap) + cell / 2}" font-size="76" text-anchor="middle" dominant-baseline="central">${ROW_BADGES[r] ?? ""}</text>`,
        )
        .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\
<rect width="${width}" height="${height}" fill="#0f172a"/>\
<text x="${width / 2}" y="${top - 64}" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="64" font-weight="700" text-anchor="middle">${escapeXml(heading)}</text>\
${badges}\
${cells}\
<text x="${width / 2}" y="${top + gridH + 96}" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="40" text-anchor="middle">plinky.fun</text>\
</svg>`;
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
