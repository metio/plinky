// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A rhythm drawn as one line of notation.
//
// Deliberately not the engraver the rest of the app uses. A rhythm has no pitch, so it
// needs no clef, no key, no staff to place anything on — one line, noteheads on it, and
// the beams that group them. Rendering it through the full score engine would pull the
// whole notation machinery onto a page that needs none of it, and every generated bar
// would have to be marshalled through MusicXML on its way to being drawn.
//
// Colours come from `currentColor` rather than baked hexes, unlike the keyboard diagram:
// that one leaves as a file with no stylesheet to read, this one stays on a page that has
// one, and a rhythm that ignored the reader's theme would glow white in a dark room.

import type { Cell, RhythmPattern } from "./rhythmPattern";
import { cellBeats } from "./rhythmPattern";

export const STAFF_HEIGHT = 120;
const LINE_Y = 74;
const NOTE_RY = 6;
const NOTE_RX = 8;
const STEM_HEIGHT = 38;
const STEM_TOP = LINE_Y - STEM_HEIGHT;
const BEAM_THICKNESS = 5;
const BEAM_GAP = 8;
const LEFT = 28;
const RIGHT_PAD = 28;
// Room a bar gets per beat. Wide enough that four sixteenths do not touch.
const BEAT_WIDTH = 96;

// Which durations carry a stem, and how many flags or beams they take.
const TAILS: Record<string, number> = {
    eighth: 1,
    "dotted-eighth": 1,
    "triplet-eighth": 1,
    sixteenth: 2,
};
const STEMMED = new Set([
    "half",
    "dotted-half",
    "quarter",
    "dotted-quarter",
    "dotted-eighth",
    "eighth",
    "sixteenth",
    "triplet-eighth",
]);
const HOLLOW = new Set(["whole", "half", "dotted-half"]);
const DOTTED = new Set(["dotted-half", "dotted-quarter", "dotted-eighth"]);

export type RhythmMark = "perfect" | "good" | "off" | "missed" | null;

export type NotationOptions = {
    pattern: RhythmPattern;
    // One entry per written note, in written order — the result of a run, drawn under the
    // notes it belongs to. Absent while the reader is still reading.
    marks?: readonly RhythmMark[];
    // Which written note is sounding right now, for the moving cursor.
    activeNote?: number | null;
    // What a screen reader should hear. Given here rather than by a wrapper, because a
    // labelled element around an unlabelled `role="img"` leaves the inner one nameless —
    // which is a genuine failure, not a lint detail. Without a label the drawing is
    // hidden instead, which is right for the decorative case.
    label?: string;
};

export type RhythmLayout = {
    width: number;
    height: number;
    // The x of every cell, written order — the same order `cells` is in.
    xs: number[];
    // The x of every non-rest cell, in the order the grader counts them.
    noteXs: number[];
    barLines: number[];
};

// Where everything sits. Separated from the markup so a surface can put its own overlay
// at the right x without re-deriving the spacing, and so the spacing itself is testable.
export function rhythmLayout(pattern: RhythmPattern): RhythmLayout {
    const starts = cellBeats(pattern);
    const xs = starts.map((beats) => LEFT + beats * BEAT_WIDTH);
    const noteXs: number[] = [];
    pattern.cells.forEach((cell, index) => {
        if (!cell.rest) {
            noteXs.push(xs[index] as number);
        }
    });
    // A bar line sits in the gap before the next bar's first note, not on top of it —
    // so it is drawn back from the beat it precedes. The layout carries the drawn
    // position rather than the beat's, so nothing downstream has to re-apply the offset
    // and the staff can be ended exactly where the closing line is.
    const barLines: number[] = [];
    for (let bar = 1; bar <= pattern.bars; bar++) {
        barLines.push(LEFT + bar * pattern.beatsPerBar * BEAT_WIDTH - BEAT_WIDTH * 0.15);
    }
    return {
        width: LEFT + pattern.bars * pattern.beatsPerBar * BEAT_WIDTH + RIGHT_PAD,
        height: STAFF_HEIGHT,
        xs,
        noteXs,
        barLines,
    };
}

function restMarkup(cell: Cell, x: number): string {
    // A rest is drawn as a plain block on or under the line. It is not the engraved
    // shape, and it is not pretending to be: what has to be legible here is that this
    // beat is silent and how long the silence lasts, which a block of the right width
    // says without asking the reader to know four different squiggles.
    const width = Math.max(10, cell.beats * BEAT_WIDTH * 0.4);
    return `<rect x="${round(x - width / 2)}" y="${LINE_Y - 16}" width="${round(width)}" height="8" rx="2" fill="currentColor" opacity="0.35"/>`;
}

function headMarkup(cell: Cell, x: number): string {
    const hollow = HOLLOW.has(cell.value);
    const head = hollow
        ? `<ellipse cx="${round(x)}" cy="${LINE_Y}" rx="${NOTE_RX}" ry="${NOTE_RY}" fill="none" stroke="currentColor" stroke-width="2.5"/>`
        : `<ellipse cx="${round(x)}" cy="${LINE_Y}" rx="${NOTE_RX}" ry="${NOTE_RY}" fill="currentColor"/>`;
    const dot = DOTTED.has(cell.value)
        ? `<circle cx="${round(x + NOTE_RX + 6)}" cy="${LINE_Y}" r="2.5" fill="currentColor"/>`
        : "";
    const stem = STEMMED.has(cell.value)
        ? `<line x1="${round(x + NOTE_RX - 1)}" y1="${LINE_Y}" x2="${round(x + NOTE_RX - 1)}" y2="${STEM_TOP}" stroke="currentColor" stroke-width="2"/>`
        : "";
    return `${head}${dot}${stem}`;
}

// A flag, for a tailed note standing on its own. Beamed notes get beams instead.
function flagMarkup(cell: Cell, x: number): string {
    const tails = TAILS[cell.value] ?? 0;
    const parts: string[] = [];
    for (let tail = 0; tail < tails; tail++) {
        const y = STEM_TOP + tail * BEAM_GAP;
        parts.push(
            `<path d="M ${round(x + NOTE_RX - 1)} ${round(y)} q 12 6 10 18" fill="none" stroke="currentColor" stroke-width="2.5"/>`,
        );
    }
    return parts.join("");
}

function beamMarkup(cells: Cell[], xs: number[]): string {
    if (cells.length < 2) {
        return "";
    }
    const first = xs[0] as number;
    const last = xs[xs.length - 1] as number;
    const parts: string[] = [];
    // The group's beam count is its shortest note's — one beam spans the group, and the
    // extra beams a shorter note needs are drawn only over the notes that need them.
    const full = Math.min(...cells.map((cell) => TAILS[cell.value] ?? 1));
    for (let beam = 0; beam < full; beam++) {
        const y = STEM_TOP + beam * BEAM_GAP;
        parts.push(
            `<rect x="${round(first + NOTE_RX - 2)}" y="${round(y)}" width="${round(last - first + 2)}" height="${BEAM_THICKNESS}" fill="currentColor"/>`,
        );
    }
    // Above the group's shared beam, the extra beams a shorter note needs are drawn over
    // the notes that need them — and two neighbours that both need one share a single
    // segment rather than each growing a stub of its own. That shared segment is what
    // tells a reader the two sixteenths are a pair; two stubs would say the opposite.
    // Only a note with no such neighbour gets a stub, and it leans toward the note it
    // belongs with rather than out into the gap.
    const deepest = Math.max(...cells.map((cell) => TAILS[cell.value] ?? 1));
    for (let beam = full; beam < deepest; beam++) {
        const y = STEM_TOP + beam * BEAM_GAP;
        let index = 0;
        while (index < cells.length) {
            if ((TAILS[cells[index]?.value ?? ""] ?? 1) <= beam) {
                index += 1;
                continue;
            }
            let end = index;
            while (end + 1 < cells.length && (TAILS[cells[end + 1]?.value ?? ""] ?? 1) > beam) {
                end += 1;
            }
            const from = xs[index] as number;
            const to = xs[end] as number;
            if (end > index) {
                parts.push(
                    `<rect x="${round(from + NOTE_RX - 2)}" y="${round(y)}" width="${round(to - from + 2)}" height="${BEAM_THICKNESS}" fill="currentColor"/>`,
                );
            } else {
                // A lone one: half the distance to whichever neighbour it has.
                const towardPrevious = index > 0;
                const anchor = towardPrevious
                    ? (xs[index - 1] as number)
                    : (xs[index + 1] as number);
                const width = Math.abs(from - anchor) / 2;
                const stubX = towardPrevious ? from - width : from;
                parts.push(
                    `<rect x="${round(stubX + NOTE_RX - 2)}" y="${round(y)}" width="${round(width)}" height="${BEAM_THICKNESS}" fill="currentColor"/>`,
                );
            }
            index = end + 1;
        }
    }
    return parts.join("");
}

const MARK_COLOR: Record<Exclude<RhythmMark, null>, string> = {
    perfect: "var(--color-success)",
    good: "var(--color-warn)",
    off: "var(--color-danger)",
    missed: "var(--color-muted)",
};

export function rhythmSvg({ pattern, marks, activeNote, label }: NotationOptions): string {
    const layout = rhythmLayout(pattern);
    const { xs } = layout;

    const groups = new Map<number, number[]>();
    pattern.cells.forEach((cell, index) => {
        if (cell.group !== undefined && !cell.rest) {
            groups.set(cell.group, [...(groups.get(cell.group) ?? []), index]);
        }
    });
    const beamed = new Set([...groups.values()].filter((one) => one.length > 1).flat());

    // The line stops at the closing bar line. Running on past it would draw a staff that
    // continues into music that is not there.
    const lineEnd = layout.barLines.at(-1) ?? layout.width - RIGHT_PAD;
    const parts: string[] = [
        `<line x1="${LEFT - 12}" y1="${LINE_Y}" x2="${round(lineEnd)}" y2="${LINE_Y}" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>`,
    ];
    for (const x of layout.barLines) {
        parts.push(
            `<line x1="${round(x)}" y1="${LINE_Y - 26}" x2="${round(x)}" y2="${LINE_Y + 18}" stroke="currentColor" stroke-width="2" opacity="0.4"/>`,
        );
    }

    pattern.cells.forEach((cell, index) => {
        const x = xs[index] as number;
        if (cell.rest) {
            parts.push(restMarkup(cell, x));
            return;
        }
        parts.push(headMarkup(cell, x));
        if (!beamed.has(index)) {
            parts.push(flagMarkup(cell, x));
        }
    });

    for (const indices of groups.values()) {
        if (indices.length > 1) {
            parts.push(
                beamMarkup(
                    indices.map((index) => pattern.cells[index] as Cell),
                    indices.map((index) => xs[index] as number),
                ),
            );
        }
    }

    // A triplet says so, or it is a lie: three eighths in the space of two look exactly
    // like three eighths unless the 3 is there.
    for (const [, indices] of groups) {
        const first = pattern.cells[indices[0] as number] as Cell;
        if (first.value === "triplet-eighth") {
            const mid =
                ((xs[indices[0] as number] as number) +
                    (xs[indices[indices.length - 1] as number] as number)) /
                2;
            parts.push(
                `<text x="${round(mid)}" y="${STEM_TOP - 8}" text-anchor="middle" font-size="14" font-family="system-ui,sans-serif" fill="currentColor">3</text>`,
            );
        }
    }

    if (marks) {
        layout.noteXs.forEach((x, note) => {
            const mark = marks[note];
            if (mark) {
                parts.push(
                    `<circle cx="${round(x)}" cy="${LINE_Y + 26}" r="4.5" fill="${MARK_COLOR[mark]}"/>`,
                );
            }
        });
    }

    if (activeNote !== null && activeNote !== undefined) {
        const x = layout.noteXs[activeNote];
        if (x !== undefined) {
            parts.push(
                `<circle cx="${round(x)}" cy="${LINE_Y}" r="16" fill="none" stroke="var(--color-accent-solid)" stroke-width="2.5"/>`,
            );
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(layout.width)} ${layout.height}" width="${round(layout.width)}" height="${layout.height}" ${
        label ? `role="img" aria-label="${escapeXml(label)}"` : 'aria-hidden="true"'
    }>${parts.join("")}</svg>`;
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}
