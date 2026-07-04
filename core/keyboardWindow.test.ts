// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    DEFAULT_KEYBOARD_SPAN,
    followKeyboardWindow,
    nextKeyboardWindow,
    type Span,
} from "./keyboardWindow";

const SPAN = DEFAULT_KEYBOARD_SPAN;

describe("nextKeyboardWindow", () => {
    it("returns null without a range", () => {
        expect(nextKeyboardWindow(null, null, [])).toBeNull();
    });

    it("shows the whole range unchanged when the piece fits in the window", () => {
        const range: Span = { from: 60, to: 60 + SPAN };
        expect(nextKeyboardWindow(null, range, [64])).toEqual(range);
    });

    it("frames a bounded window for a piece wider than the cap", () => {
        const range: Span = { from: 40, to: 100 }; // five octaves
        const win = nextKeyboardWindow(null, range, [70])!;
        expect(win.to - win.from).toBe(SPAN);
        expect(70).toBeGreaterThanOrEqual(win.from);
        expect(70).toBeLessThanOrEqual(win.to);
    });

    it("centres the window on the active notes, leaving reading room each side", () => {
        const range: Span = { from: 40, to: 100 };
        const win = nextKeyboardWindow(null, range, [70])!;
        // 70 sits near the middle of a 24-semitone window.
        expect(win.from).toBe(70 - SPAN / 2);
        expect(win.to).toBe(70 + SPAN / 2);
    });

    it("holds the window still while the notes stay inside it", () => {
        const range: Span = { from: 40, to: 100 };
        const prev = nextKeyboardWindow(null, range, [70])!;
        // A note a step away is still framed — same window object, no jump.
        expect(nextKeyboardWindow(prev, range, [72])).toBe(prev);
    });

    it("re-frames once the notes leave the window", () => {
        const range: Span = { from: 40, to: 100 };
        const prev = nextKeyboardWindow(null, range, [70])!;
        const next = nextKeyboardWindow(prev, range, [95])!;
        expect(next).not.toEqual(prev);
        expect(95).toBeLessThanOrEqual(next.to);
        expect(95).toBeGreaterThanOrEqual(next.from);
    });

    it("clamps the window inside the piece range at the extremes", () => {
        const range: Span = { from: 40, to: 100 };
        const low = nextKeyboardWindow(null, range, [41])!;
        expect(low.from).toBe(40);
        const high = nextKeyboardWindow(null, range, [99])!;
        expect(high.to).toBe(100);
    });

    it("widens to fit a chord broader than the cap", () => {
        const range: Span = { from: 40, to: 100 };
        const win = nextKeyboardWindow(null, range, [50, 90])!;
        expect(win.from).toBeLessThanOrEqual(50);
        expect(win.to).toBeGreaterThanOrEqual(90);
    });

    it("keeps the previous window when there are no active notes", () => {
        const range: Span = { from: 40, to: 100 };
        const prev = nextKeyboardWindow(null, range, [70])!;
        expect(nextKeyboardWindow(prev, range, [])).toBe(prev);
    });
});

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
