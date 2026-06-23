// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, loadTheme, resolveTheme, saveTheme } from "./theme";

afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
});

describe("theme", () => {
    it("defaults to system", () => {
        expect(loadTheme()).toBe("system");
    });

    it("round-trips a stored theme", () => {
        saveTheme("dark");
        expect(loadTheme()).toBe("dark");
    });

    it("ignores an invalid stored value", () => {
        localStorage.setItem("plinky:theme", "neon");
        expect(loadTheme()).toBe("system");
    });

    it("resolves explicit themes directly", () => {
        expect(resolveTheme("light")).toBe("light");
        expect(resolveTheme("dark")).toBe("dark");
    });

    it("toggles the dark class on the document", () => {
        applyTheme("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        applyTheme("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
});
