// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo, useState } from "react";
import { type Bar, windowCells, windowPositions } from "../../core/scoreToBars";

// A sliding bar window over a piece: the fingering editor (and anything else
// that works a piece a couple of bars at a time) reads the window's positions
// and cells, and steps it with prev/next. The start clamps to the piece, so a
// hand with fewer bars — or a piece shorter than the window — never strands the
// window past the end.
export function useBarWindow(bars: Bar[], size: number) {
    const [start, setStart] = useState(0);
    const lastStart = Math.max(0, bars.length - size);
    const clamped = Math.min(start, lastStart);
    const positions = useMemo(() => windowPositions(bars, clamped, size), [bars, clamped, size]);
    const cells = useMemo(() => windowCells(bars, clamped, size), [bars, clamped, size]);
    return {
        // The window's first bar (0-based) and its content.
        start: clamped,
        end: Math.min(clamped + size, bars.length),
        positions,
        cells,
        canPrev: clamped > 0,
        canNext: clamped < lastStart,
        prev: () => setStart((s) => Math.max(0, Math.min(s, lastStart) - 1)),
        next: () => setStart((s) => Math.min(lastStart, Math.min(s, lastStart) + 1)),
        reset: () => setStart(0),
    };
}
