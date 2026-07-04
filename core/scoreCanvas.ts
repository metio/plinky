// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The pure half of painting a rendered score: the colour language every score
// surface shares, and the geometry of picking a bar from a click. The
// OSMD-coupled painting itself lives in app/lib/scoreColor.

// The colour a note turns once it has been played, marking progress on the score.
export const PLAYED_COLOR = "#22c55e";
// The colour marking where the racing ghost currently is, distinct from played
// (green) and the score's own black so all three read apart at a glance.
export const GHOST_COLOR = "#a855f7";
// The score is always rendered on white, so an unplayed note is plain black.
export const NOTE_COLOR = "#000000";
// The active window in a read-only context staff — the bars currently being fingered
// or heard, indigo to match the app's accent and stand out from the black notes.
export const WINDOW_COLOR = "#6366f1";
// The loop selection is filled behind its bars in a bright red so the stretch you're
// about to drill reads at a glance — the same red the share grid's weakest band uses.
export const SELECT_COLOR = "#ef4444";

// A rendered measure's bounding box in SVG user units.
export type MeasureBox = { measure: number; x: number; y: number; width: number; height: number };

// The 0-based measure a point falls in: the box that contains it, or — for a click in a
// bar's empty space, between its notes or above/below them — the nearest box, weighting
// vertical distance heavily so the pick stays on the clicked row. Null when there are no
// boxes (nothing has rendered).
export function measureAtPoint(boxes: MeasureBox[], x: number, y: number): number | null {
    if (boxes.length === 0) {
        return null;
    }
    for (const box of boxes) {
        if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
            return box.measure;
        }
    }
    let best: MeasureBox | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const box of boxes) {
        const dx = x < box.x ? box.x - x : x > box.x + box.width ? x - (box.x + box.width) : 0;
        const dy = y < box.y ? box.y - y : y > box.y + box.height ? y - (box.y + box.height) : 0;
        // Vertical distance dominates so a click lands on a bar in its own row, not one
        // horizontally closer on the line above or below.
        const score = dy * 1000 + dx;
        if (score < bestScore) {
            bestScore = score;
            best = box;
        }
    }
    return best ? best.measure : null;
}
