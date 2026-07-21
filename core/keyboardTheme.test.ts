// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, KEYBOARD_THEMES } from "./keyboardTheme";

describe("keyboard themes", () => {
    it("makes classic the default", () => {
        expect(DEFAULT_THEME.id).toBe("classic");
        expect(KEYBOARD_THEMES[0]).toBe(DEFAULT_THEME);
    });

    it("offers every skin with a distinct id and its resting palette", () => {
        const ids = KEYBOARD_THEMES.map((theme) => theme.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const theme of KEYBOARD_THEMES) {
            expect(theme.white).toContain("bg-");
            expect(theme.black).toContain("bg-");
        }
    });
});
