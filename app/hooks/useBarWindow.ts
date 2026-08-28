// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { type Bar, windowCells, windowGaps, windowPositions } from "../../core/scoreToBars";

// A sliding bar window over a piece: the fingering editor (and anything else
// that works a piece a couple of bars at a time) reads the window's positions
// and cells, and steps it with prev/next. The start clamps to the piece, so a
// hand with fewer bars — or a piece shorter than the window — never strands the
// window past the end.
// `gaps` is parallel to `bars` — how long the hand has before each position sounds. Passed
// separately rather than folded into Bar so the ear drill, which has no use for it, is
// unaffected. Omitted, the window reports no gaps and its consumer fingers on shape alone.
export function useBarWindow(bars: Bar[], size: number, gaps?: number[][]) {
    const [start, setStart] = useState(0);
    const lastStart = Math.max(0, bars.length - size);
    const clamped = Math.min(start, lastStart);
    const positions = useMemo(() => windowPositions(bars, clamped, size), [bars, clamped, size]);
    const cells = useMemo(() => windowCells(bars, clamped, size), [bars, clamped, size]);
    const windowed = useMemo(
        () => (gaps === undefined ? undefined : windowGaps(gaps, clamped, size)),
        [gaps, clamped, size],
    );
    return {
        // The window's first bar (0-based) and its content.
        start: clamped,
        end: Math.min(clamped + size, bars.length),
        positions,
        cells,
        gaps: windowed,
        canPrev: clamped > 0,
        canNext: clamped < lastStart,
        prev: () => setStart((s) => Math.max(0, Math.min(s, lastStart) - 1)),
        next: () => setStart((s) => Math.min(lastStart, Math.min(s, lastStart) + 1)),
        reset: () => setStart(0),
    };
}
