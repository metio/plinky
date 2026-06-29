// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { fluentNotes } from "./flow";
import { PRECISE_TOLERANCE, timingDeltas } from "./rhythm";

// Compiles a finished run into a Wordle-style share artifact: the run is sliced
// into six moments and scored on the three shareable dimensions — Accuracy,
// Timing, Flow — each landing in one of five colour bands. The result is a 3×6 grid
// rendered as an emoji block (text share) or an SVG card (image share). The grid
// deliberately carries no numbers or labels: the shape is the thing people share.
// Five bands (not three) so runs produce visibly different grids rather than a wall
// of one colour. The cutoffs are tuned for the share — a good run reads mostly green
// while a weak run still spreads across orange and red — and the same five colours
// back every surface (emoji text, image card, in-app grid) so a Plinky share is
// recognisable wherever it is posted.

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

// Five colour bands tuned for the shared grid rather than the grade letter. A good
// run reads mostly green, while a weak run still spreads across orange and red
// instead of collapsing into one gray block — only a near-empty segment falls to the
// bottom "absent" band. The bands stretch lower than the grade's A–F cutoffs on
// purpose: a metric like timing clusters low, and a wall of one colour is no fun to
// share. The same five levels back the emoji text, the image card and the in-app
// grid, so a Plinky share looks the same wherever it's posted.
const BANDS: ReadonlyArray<readonly [number, Level]> = [
    [0.78, "best"],
    [0.58, "good"],
    [0.38, "ok"],
    [0.12, "weak"],
];

export function levelFor(value: number): Level {
    for (const [min, level] of BANDS) {
        if (value >= min) {
            return level;
        }
    }
    return "none";
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

export function gridEmoji(grid: Grid): string {
    return grid.map((row) => row.map((level) => EMOJI[level]).join("")).join("\n");
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
    const gridW = cols * cell + (cols - 1) * gap;
    const gridH = rows * cell + (rows - 1) * gap;
    const gridLeft = (width - gridW) / 2;
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
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\
<rect width="${width}" height="${height}" fill="#0f172a"/>\
<text x="${width / 2}" y="${top - 64}" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="64" font-weight="700" text-anchor="middle">${escapeXml(heading)}</text>\
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
