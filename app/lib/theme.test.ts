// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { applyTheme } from "./theme";

const root = document.documentElement;

// jsdom resolves no stylesheet, so the token it reports is whatever is set inline here —
// which is all this needs: the point is that the chrome takes the resolved `raised`,
// not what any one palette resolves it to. dev/tokenContrast.test.mts owns the values.
function withRaised(value: string): HTMLMetaElement {
    root.style.setProperty("--color-raised", value);
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "#ffffff");
    document.head.append(meta);
    return meta;
}

afterEach(() => {
    root.classList.remove("dark", "black");
    root.removeAttribute("data-palette");
    root.style.removeProperty("--color-raised");
    for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) {
        meta.remove();
    }
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

    it("paints the browser's chrome the colour the header resolves to", () => {
        const meta = withRaised("#211a2c");
        applyTheme({ palette: "fuchsia", mode: "dark" });
        expect(meta.getAttribute("content")).toBe("#211a2c");
    });

    it("follows every later pick, so the chrome never keeps the ground it left", () => {
        const meta = withRaised("#211a2c");
        applyTheme({ palette: "fuchsia", mode: "dark" });
        root.style.setProperty("--color-raised", "#ffffff");
        applyTheme({ palette: "fuchsia", mode: "light" });
        expect(meta.getAttribute("content")).toBe("#ffffff");
    });

    it("leaves the document's own value alone when the token resolves to nothing", () => {
        // A stylesheet that has not loaded resolves to the empty string, and a chrome
        // painted with it would be the browser's default rather than the page's.
        const meta = withRaised("");
        applyTheme({ palette: "fuchsia", mode: "light" });
        expect(meta.getAttribute("content")).toBe("#ffffff");
    });

    it("stamps the theme even on a document carrying no such tag", () => {
        applyTheme({ palette: "violet", mode: "black" });
        expect(root.classList.contains("black")).toBe(true);
        expect(root.getAttribute("data-palette")).toBe("violet");
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
