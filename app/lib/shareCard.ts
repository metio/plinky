// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { PRECISE_TOLERANCE, timingDeltas } from "./rhythm";

// Compiles a finished run into a Wordle-style share artifact: the run is sliced into six
// moments, each scored on Accuracy, Speed and Timing, and those three are collapsed into
// one combined cell — so a moment reads as a single "how well did you play it" square.
// The grid runs one row per hand: a single row for a single-staff piece, two (right then
// left) once both hands are in play, so a lagging hand shows as a redder row against the
// other. Each cell lands in one of five colour bands. Rendered as an emoji block (text
// share) or an SVG card (image share); the grid deliberately carries no numbers.
//
// The scoring is deliberately NOT the gentle, self-paced grade the practice letter uses.
// The grade forgives a slow, careful run so practice stays encouraging; the share card is
// an honest snapshot meant to separate a strong performance from a weak one at a glance,
// so it rewards playing at the piece's own tempo (Speed) — which a slow mouse-on-a-screen
// run can't fake — and judges timing at the precise window rather than a widened one. The
// same five colours back every surface (emoji text, image card, in-app grid) so a Plinky
// share is recognisable wherever it is posted.

// One cleared note of a run, relative to the run's first note: its notated onset
// (the ideal), when it was actually played, how many wrong notes preceded it, and the
// staves it sat on (0 = treble/right, 1 = bass/left) so the run can be scored per hand.
export type RunNote = {
    targetMs: number;
    playedMs: number;
    wrongBefore: number;
    staves?: number[];
};

// A run note tagged with how close to the piece's tempo it was played and its timing
// deviation from the player's own pace — both decided once over the whole run, not a
// six-note slice, so pace and rhythm are judged across the whole performance.
type ScoredNote = RunNote & { speed: number; timingDelta: number };

// The three scored dimensions of a segment, collapsed into one combined cell for the
// shared grid.
type Dimension = "accuracy" | "speed" | "timing";
export type SegmentMetrics = Record<Dimension, number>; // each 0..1

// How much a run's timing window is relative to the shared reference, and how the run's
// own tempo related to the piece's — 1 when it was played at the piece's intended tempo,
// below 1 when slower, so Speed measures the performance, not the practice-tempo dial.
export type ShareOptions = { tolerance?: number; tempoScale?: number };

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

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

// How close each note was played to the piece's intended tempo, 0..1 (1 = at or above
// tempo). A note's local pace is its notated gap over the actual gap, scaled by how the
// run's own tempo related to the piece's — so a piece played slowly reads low however the
// practice tempo was dialled. Playing faster than the piece is capped at the top band
// rather than rewarded past it. The first note has no preceding gap, so it borrows the
// next note's pace instead of being judged on an unmeasurable one.
export function speedFactors(notes: RunNote[], tempoScale = 1): number[] {
    const speeds = notes.map((note, index) => {
        if (index === 0) {
            return 1;
        }
        const previous = notes[index - 1]!;
        const notatedGap = note.targetMs - previous.targetMs;
        const playedGap = note.playedMs - previous.playedMs;
        // A non-positive gap (a repeated onset, or clock noise) carries no pace signal.
        if (notatedGap <= 0 || playedGap <= 0) {
            return 1;
        }
        return clamp01((tempoScale * notatedGap) / playedGap);
    });
    if (speeds.length > 1) {
        speeds[0] = speeds[1]!;
    }
    return speeds;
}

// Scores one segment's notes on each dimension. An empty segment (a piece with
// fewer notes than segments, or one abandoned early) scores zero everywhere.
function metricsFor(notes: ScoredNote[], tolerance: number): SegmentMetrics {
    if (notes.length === 0) {
        return { accuracy: 0, speed: 0, timing: 0 };
    }
    const wrong = notes.reduce((sum, note) => sum + note.wrongBefore, 0);
    const speed = notes.reduce((sum, note) => sum + note.speed, 0);
    const zero = TIMING_ZERO_MS * tolerance;
    const timing = notes.reduce((sum, note) => {
        const off = Math.min(1, Math.abs(note.timingDelta) / zero);
        return sum + (1 - off);
    }, 0);
    return {
        accuracy: notes.length / (notes.length + wrong),
        speed: speed / notes.length,
        timing: timing / notes.length,
    };
}

// Splits the run into SEGMENTS contiguous, proportional slices by note order, so
// the grid reads the same whatever the piece's length or tempo, and scores each.
// Speed and the timing deviations are decided over the whole run first, then carried
// into the slices. Timing defaults to the precise window (the share card judges the
// performance honestly rather than widening for imprecise input).
export function computeSegments(
    notes: RunNote[],
    count = SEGMENTS,
    options: ShareOptions = {},
): SegmentMetrics[] {
    const { tolerance = PRECISE_TOLERANCE, tempoScale = 1 } = options;
    const speeds = speedFactors(notes, tempoScale);
    const deltas = timingDeltas(notes);
    const buckets: ScoredNote[][] = Array.from({ length: count }, () => []);
    notes.forEach((note, index) => {
        const slice = Math.min(count - 1, Math.floor((index * count) / notes.length));
        buckets[slice]?.push({
            ...note,
            speed: speeds[index] ?? 1,
            timingDelta: deltas[index] ?? 0,
        });
    });
    return buckets.map((bucket) => metricsFor(bucket, tolerance));
}

// One row per named dimension, one column per segment. Generic over the dimension set so
// the lifetime fingerprint on the You page renders its own trio through the same banding.
export function toGrid<K extends string>(
    segments: ReadonlyArray<Record<K, number>>,
    dimensions: readonly K[],
): Grid {
    return dimensions.map((dimension) => segments.map((segment) => levelFor(segment[dimension])));
}

// A segment's three dimensions collapsed to one score, so the shared grid reads as a
// single "how well did you play this moment" cell per column rather than three. The
// weakest dimension wins: a moment is only as good as its worst aspect, so a crawl (low
// Speed) or a slip (low Accuracy) drags the cell down even when the others are perfect —
// the averaging alternative floors every clean run near green and hides the difference.
function combined(metrics: SegmentMetrics): number {
    return Math.min(metrics.accuracy, metrics.speed, metrics.timing);
}

// The staves a run touched, top to bottom (treble/right = 0 before bass/left = 1) — one
// grid row per hand actually played. A note with no staves recorded counts as the top.
export function handsPlayed(notes: RunNote[]): number[] {
    const staves = new Set<number>();
    for (const note of notes) {
        for (const staff of note.staves ?? [0]) {
            staves.add(staff);
        }
    }
    return staves.size > 0 ? [...staves].sort((a, b) => a - b) : [0];
}

// The shared grid: one row per hand the run touched — just one for a single-staff piece,
// two (right then left) for a grand staff — each a run of six combined-score cells. A
// moment that sounds on both staves counts toward both hands' rows.
export function handGrid(notes: RunNote[], options: ShareOptions = {}): Grid {
    return handsPlayed(notes).map((staff) => {
        const handNotes = notes.filter((note) => (note.staves ?? [0]).includes(staff));
        return computeSegments(handNotes, SEGMENTS, options).map((segment) =>
            levelFor(combined(segment)),
        );
    });
}

// Each hand's overall combined score (0..1), measured over all its notes at once rather
// than per segment — so a short hand isn't dragged down by the empty slices a six-column
// grid would leave it. Same top-to-bottom hand order as the grid.
export function handScores(
    notes: RunNote[],
    options: ShareOptions = {},
): { staff: number; overall: number }[] {
    return handsPlayed(notes).map((staff) => {
        const handNotes = notes.filter((note) => (note.staves ?? [0]).includes(staff));
        const [whole] = computeSegments(handNotes, 1, options);
        return { staff, overall: whole ? combined(whole) : 0 };
    });
}

// How much one hand may trail the other before it reads as lagging rather than even —
// about one colour band, so a real gap is called out but a hair's difference isn't.
const HAND_GAP = 0.12;

// The verdict on a two-hand run: which hand trailed the other, or that they kept pace.
// Null for a single-hand run, where there's nothing to compare.
export type HandVerdict = "even" | "right" | "left" | null;

export function laggingHand(notes: RunNote[], options: ShareOptions = {}): HandVerdict {
    const scores = handScores(notes, options);
    const right = scores.find((score) => score.staff === 0);
    const left = scores.find((score) => score.staff === 1);
    if (!right || !left) {
        return null;
    }
    const gap = right.overall - left.overall;
    if (gap > HAND_GAP) {
        return "left";
    }
    if (gap < -HAND_GAP) {
        return "right";
    }
    return "even";
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
