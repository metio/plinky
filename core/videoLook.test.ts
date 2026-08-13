// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    DEFAULT_KEYBOARD_DEPTH,
    DEFAULT_NOTE_COLOR,
    KEYBOARD_DEPTHS,
    keyboardDepthFraction,
    NOTE_COLORS,
    noteColorHex,
} from "./videoLook";

describe("note colours", () => {
    it("leads with the app's own accent, so an untouched export looks like the app", () => {
        expect(NOTE_COLORS[0]?.id).toBe(DEFAULT_NOTE_COLOR);
        expect(noteColorHex(DEFAULT_NOTE_COLOR)).toBe("#6366f1");
    });

    it("gives every colour a canvas hex", () => {
        for (const color of NOTE_COLORS) {
            expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
        }
    });

    it("falls back to the default rather than painting nothing", () => {
        // A stored choice from a build that offered a colour this one does not must not
        // leave the blocks unpainted.
        expect(noteColorHex("chartreuse-from-the-future")).toBe(noteColorHex(DEFAULT_NOTE_COLOR));
    });

    it("names each colour once", () => {
        expect(new Set(NOTE_COLORS.map((c) => c.id)).size).toBe(NOTE_COLORS.length);
    });
});

describe("keyboard depth", () => {
    it("defaults to a shallow keyboard, which reads as keys rather than as a wall", () => {
        expect(keyboardDepthFraction(DEFAULT_KEYBOARD_DEPTH)).toBe(0.16);
    });

    it("offers depths in order, all of them a sane share of the frame", () => {
        const fractions = KEYBOARD_DEPTHS.map((depth) => depth.fraction);
        expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
        for (const fraction of fractions) {
            expect(fraction).toBeGreaterThan(0.05);
            expect(fraction).toBeLessThan(0.5);
        }
    });

    it("falls back to the default for an unknown depth", () => {
        expect(keyboardDepthFraction("colossal")).toBe(keyboardDepthFraction(DEFAULT_KEYBOARD_DEPTH));
    });
});
