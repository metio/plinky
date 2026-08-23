// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    BY_FINGER,
    BY_HAND,
    DEFAULT_KEYBOARD_DEPTH,
    DEFAULT_NOTE_COLOR,
    FINGER_COLORS,
    HAND_COLORS,
    HIGHWAY_SCHEMES,
    KEYBOARD_DEPTHS,
    NOTE_COLORS,
    fingerColorHex,
    handColorHex,
    keyboardDepthFraction,
    noteColorHex,
    notePaint,
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
        expect(keyboardDepthFraction("colossal")).toBe(
            keyboardDepthFraction(DEFAULT_KEYBOARD_DEPTH),
        );
    });
});

describe("finger colours", () => {
    it("names one colour per finger", () => {
        expect(FINGER_COLORS).toHaveLength(5);
        expect(new Set(FINGER_COLORS).size).toBe(5);
    });

    it("maps a finger to its own colour, thumb first", () => {
        expect(fingerColorHex(1, "#000000")).toBe(FINGER_COLORS[0]);
        expect(fingerColorHex(5, "#000000")).toBe(FINGER_COLORS[4]);
    });

    it("falls back for a note nobody fingered, so the frame is never blank", () => {
        expect(fingerColorHex(undefined, "#123456")).toBe("#123456");
        expect(fingerColorHex(9, "#123456")).toBe("#123456");
    });

    it("offers by-finger as a note colour, with a hex for the unfingered case", () => {
        const option = NOTE_COLORS.find((color) => color.id === BY_FINGER);
        expect(option?.hex).toMatch(/^#[0-9a-f]{6}$/);
    });
});

describe("the colour schemes the two pictures share", () => {
    it("answers every scheme it offers", () => {
        // The list and the decision must not come apart: a scheme a picker offers and
        // nothing can paint is a control that appears to do nothing.
        for (const scheme of HIGHWAY_SCHEMES) {
            const paint = notePaint(scheme, { finger: 3, hand: "left" });
            expect(["finger", "hand", "flat"]).toContain(paint.kind);
        }
    });

    it("reads the finger, the hand, or neither, according to the scheme", () => {
        expect(notePaint(BY_FINGER, { finger: 2, hand: "left" })).toEqual({
            kind: "finger",
            finger: 2,
        });
        expect(notePaint(BY_HAND, { finger: 2, hand: "left" })).toEqual({
            kind: "hand",
            hand: "left",
        });
        expect(notePaint("teal", { finger: 2, hand: "left" })).toEqual({
            kind: "flat",
            id: "teal",
        });
    });

    it("offers both of the schemes that read something off the music", () => {
        // The practice highway colours by hand and an export could only colour by finger,
        // so a player who learned what teal meant while practising met a different picture
        // watching a video of themselves.
        expect(HIGHWAY_SCHEMES).toContain(BY_FINGER);
        expect(HIGHWAY_SCHEMES).toContain(BY_HAND);
        expect(new Set(HIGHWAY_SCHEMES).size).toBe(HIGHWAY_SCHEMES.length);
    });

    it("falls back rather than painting nothing when the music does not say", () => {
        // A take nobody fingered, or a note whose hand the score never named.
        expect(fingerColorHex(undefined, "#123456")).toBe("#123456");
        expect(handColorHex(undefined, "#123456")).toBe("#123456");
    });

    it("paints the hands the same two colours the practice highway uses", () => {
        expect(handColorHex("left", "#000000")).toBe(HAND_COLORS.left);
        expect(handColorHex("right", "#000000")).toBe(HAND_COLORS.right);
    });
});
