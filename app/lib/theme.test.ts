// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { applyTheme } from "./theme";

const root = document.documentElement;

afterEach(() => {
    root.classList.remove("dark", "black");
    root.removeAttribute("data-palette");
});

describe("applyTheme", () => {
    it("toggles the dark class on the document", () => {
        applyTheme({ palette: "indigo", mode: "dark" });
        expect(root.classList.contains("dark")).toBe(true);
        applyTheme({ palette: "indigo", mode: "light" });
        expect(root.classList.contains("dark")).toBe(false);
    });

    it("paints black as a dark mode, and takes it off again", () => {
        applyTheme({ palette: "indigo", mode: "black" });
        expect(root.classList.contains("dark")).toBe(true);
        expect(root.classList.contains("black")).toBe(true);
        applyTheme({ palette: "indigo", mode: "dark" });
        expect(root.classList.contains("dark")).toBe(true);
        expect(root.classList.contains("black")).toBe(false);
    });

    it("names the palette on the document", () => {
        applyTheme({ palette: "violet", mode: "light" });
        expect(root.getAttribute("data-palette")).toBe("violet");
        applyTheme({ palette: "indigo", mode: "light" });
        expect(root.getAttribute("data-palette")).toBe("indigo");
    });

    it("resolves system from the OS preference", () => {
        const original = window.matchMedia;
        window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
        applyTheme({ palette: "indigo", mode: "system" });
        expect(root.classList.contains("dark")).toBe(true);
        expect(root.classList.contains("black")).toBe(false);
        window.matchMedia = original;
    });
});
