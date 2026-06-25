// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { fluentNotes } from "./flow";

// Compiles a finished run into a Wordle-style share artifact: the run is sliced
// into six moments and scored on the three shareable dimensions — Accuracy,
// Timing, Flow — each landing in one of three bands. The result is a 3×6 grid
// rendered as an emoji block (text share) or an SVG card (image share). The grid
// deliberately carries no numbers or labels: the shape is the thing people share.

// One cleared note of a run, relative to the run's first note: its notated onset
// (the ideal), when it was actually played, and how many wrong notes preceded it.
export type RunNote = {
    targetMs: number;
    playedMs: number;
    wrongBefore: number;
};

// A run note tagged with whether it kept the flow, decided once over the whole run
// so hesitation is judged against the player's overall pace, not a six-note slice.
type ScoredNote = RunNote & { fluent: boolean };

// The three dimensions, in the order they appear as grid rows.
export type Dimension = "accuracy" | "timing" | "flow";
export const DIMENSIONS: Dimension[] = ["accuracy", "timing", "flow"];

export type SegmentMetrics = Record<Dimension, number>; // each 0..1

export type Level = "strong" | "medium" | "weak";
export type Grid = Level[][]; // [dimension][segment]

// The number of moments a run is split into — the columns of the grid.
export const SEGMENTS = 6;

// A note this many milliseconds off its target scores zero on timing; dead-on
// scores one, with a linear ramp between.
const TIMING_ZERO_MS = 200;

// Band cutoffs: at or above STRONG is a full square, at or above MEDIUM a half,
// below it an empty one.
const STRONG = 0.85;
const MEDIUM = 0.5;

export function levelFor(value: number): Level {
    if (value >= STRONG) {
        return "strong";
    }
    if (value >= MEDIUM) {
        return "medium";
    }
    return "weak";
}

// Scores one segment's notes on each dimension. An empty segment (a piece with
// fewer notes than segments, or one abandoned early) scores zero everywhere.
function metricsFor(notes: ScoredNote[]): SegmentMetrics {
    if (notes.length === 0) {
        return { accuracy: 0, timing: 0, flow: 0 };
    }
    const wrong = notes.reduce((sum, note) => sum + note.wrongBefore, 0);
    const fluent = notes.filter((note) => note.fluent).length;
    const timing = notes.reduce((sum, note) => {
        const off = Math.min(1, Math.abs(note.playedMs - note.targetMs) / TIMING_ZERO_MS);
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
// Flow is decided over the whole run first, then carried into the slices.
export function computeSegments(notes: RunNote[], count = SEGMENTS): SegmentMetrics[] {
    const fluent = fluentNotes(notes);
    const buckets: ScoredNote[][] = Array.from({ length: count }, () => []);
    notes.forEach((note, index) => {
        const slice = Math.min(count - 1, Math.floor((index * count) / notes.length));
        buckets[slice]?.push({ ...note, fluent: fluent[index] ?? false });
    });
    return buckets.map(metricsFor);
}

// One row per dimension, one column per segment.
export function toGrid(segments: SegmentMetrics[]): Grid {
    return DIMENSIONS.map((dimension) => segments.map((segment) => levelFor(segment[dimension])));
}

export function gridFor(notes: RunNote[]): Grid {
    return toGrid(computeSegments(notes));
}

const EMOJI: Record<Level, string> = { strong: "🟩", medium: "🟨", weak: "⬜" };

export function gridEmoji(grid: Grid): string {
    return grid.map((row) => row.map((level) => EMOJI[level]).join("")).join("\n");
}

// The clipboard/social text: a one-line boast, the emoji grid, and a link back.
export function shareText(boast: string, grid: Grid, url: string): string {
    return `${boast}\n${gridEmoji(grid)}\n${url}`;
}

// Image-share colours, matched to the in-app band emoji on a dark card.
const FILL: Record<Level, string> = {
    strong: "#22c55e",
    medium: "#f59e0b",
    weak: "#374151",
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
    const left = (width - gridW) / 2;
    const top = (height - gridH) / 2;
    const cells = grid
        .flatMap((row, r) =>
            row.map((level, c) => {
                const x = left + c * (cell + gap);
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
