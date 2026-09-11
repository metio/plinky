// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { HOLD_FILL, keyFaces } from "./keyFace";
import { KEYBOARD_THEMES } from "./keyboardTheme";
import type { KeyState } from "./keyState";

const STATES: KeyState[] = ["wrong", "held", "left", "right", "next", "rest"];

describe("keyFaces", () => {
    it("rests each key on the skin's own colours", () => {
        for (const skin of KEYBOARD_THEMES) {
            const faces = keyFaces(skin);
            expect(faces.white.rest.fill).toBe(skin.white);
            expect(faces.black.rest.fill).toBe(skin.black);
        }
    });

    it("rings an expected black key instead of repainting it, so it still reads as black", () => {
        for (const skin of KEYBOARD_THEMES) {
            const next = keyFaces(skin).black.next;
            expect(next.fill.startsWith(skin.black)).toBe(true);
            expect(next.fill).toContain("ring-key-next");
            expect(next.label).toBe(keyFaces(skin).black.rest.label);
        }
    });

    it("gives every state of both key colours a fill and an ink for its name", () => {
        const faces = keyFaces(KEYBOARD_THEMES[0]!);
        for (const colour of ["white", "black"] as const) {
            for (const state of STATES) {
                const face = faces[colour][state];
                expect(face.fill).toMatch(/\bbg-|^bg-/);
                expect(face.label).toMatch(/^text-[\w-]+$/);
            }
        }
    });

    it("does not let the skin reach any state that means something", () => {
        const [one, other] = [keyFaces(KEYBOARD_THEMES[0]!), keyFaces(KEYBOARD_THEMES[1]!)];
        for (const colour of ["white", "black"] as const) {
            for (const state of ["wrong", "held", "left", "right"] as const) {
                expect(one[colour][state]).toEqual(other[colour][state]);
            }
        }
        expect(one.white.next).toEqual(other.white.next);
    });

    it("lifts a held key of either colour and gives it the held glow", () => {
        const faces = keyFaces(KEYBOARD_THEMES[0]!);
        for (const colour of ["white", "black"] as const) {
            expect(faces[colour].held.fill).toContain("translate-y-0.5");
            expect(faces[colour].held.fill).toContain("shadow-key-held");
        }
    });

    it("draws the hold bar translucent in both themes, so the key's own fill shows through", () => {
        expect(HOLD_FILL).toMatch(/^bg-key-next\/\d+ dark:bg-key-next\/\d+$/);
    });
});
