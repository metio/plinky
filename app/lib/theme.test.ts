// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { applyTheme } from "./theme";

afterEach(() => {
    document.documentElement.classList.remove("dark");
});

describe("applyTheme", () => {
    it("toggles the dark class on the document", () => {
        applyTheme("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        applyTheme("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("resolves system from the OS preference", () => {
        const original = window.matchMedia;
        window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
        applyTheme("system");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        window.matchMedia = original;
    });
});
