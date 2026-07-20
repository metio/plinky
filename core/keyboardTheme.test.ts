// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, KEYBOARD_THEMES, resolveTheme, themeUnlocked } from "./keyboardTheme";

describe("keyboard themes", () => {
    it("makes classic the always-available default", () => {
        expect(DEFAULT_THEME.id).toBe("classic");
        expect(DEFAULT_THEME.unlockGrade).toBe(0);
        expect(themeUnlocked(DEFAULT_THEME, 0)).toBe(true);
    });

    it("gates a skin behind its unlock grade", () => {
        const sunset = KEYBOARD_THEMES.find((theme) => theme.id === "sunset")!;
        expect(themeUnlocked(sunset, 1)).toBe(false);
        expect(themeUnlocked(sunset, 2)).toBe(true);
    });

    it("resolves a chosen, unlocked skin", () => {
        expect(resolveTheme("sunset", 3).id).toBe("sunset");
    });

    it("falls back to classic for a locked or unknown choice", () => {
        expect(resolveTheme("sunset", 1).id).toBe("classic");
        expect(resolveTheme("nonexistent", 9).id).toBe("classic");
    });
});
