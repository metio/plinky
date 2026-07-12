// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    DEFAULT_KEYBOARD_SPAN,
    followKeyboardWindow,
    type Span,
} from "./keyboardWindow";

const SPAN = DEFAULT_KEYBOARD_SPAN;


describe("followKeyboardWindow", () => {
    const REACH: Span = { from: 21, to: 108 }; // full 88-key piano

    it("shows the whole reach when the span covers it (e.g. 'All')", () => {
        expect(followKeyboardWindow(null, 60, Number.POSITIVE_INFINITY, REACH)).toEqual(REACH);
        const wide: Span = { from: 48, to: 60 };
        expect(followKeyboardWindow(null, 54, SPAN, wide)).toEqual(wide);
    });

    it("seeds a window of the chosen width centred on the played note", () => {
        const win = followKeyboardWindow(null, 60, SPAN, REACH);
        expect(win.to - win.from).toBe(SPAN);
        expect(win.from).toBe(60 - SPAN / 2);
    });

    it("holds while the note stays in the comfortable middle", () => {
        const prev = followKeyboardWindow(null, 60, SPAN, REACH);
        expect(followKeyboardWindow(prev, 62, SPAN, REACH)).toBe(prev);
    });

    it("re-centres when a note lands in the edge grab-zone, so you can climb", () => {
        const prev = followKeyboardWindow(null, 60, SPAN, REACH);
        // The top key of the window is in the grab-zone → the window climbs past it.
        const next = followKeyboardWindow(prev, prev.to, SPAN, REACH);
        expect(next).not.toEqual(prev);
        expect(next.to).toBeGreaterThan(prev.to);
    });

    it("clamps the window inside the reach at the extremes", () => {
        const low = followKeyboardWindow(null, 22, SPAN, REACH);
        expect(low.from).toBe(REACH.from);
        const high = followKeyboardWindow(null, 107, SPAN, REACH);
        expect(high.to).toBe(REACH.to);
    });
});
