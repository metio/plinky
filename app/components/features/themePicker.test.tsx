// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../../adapters/memoryStore";
import { m } from "../../paraglide/messages.js";
import { overwriteGetLocale } from "../../paraglide/runtime.js";
import { createThemeStore } from "../../stores/themeStore";
import { choose, chosen } from "../../testing/controls";
import { renderWithServices } from "../../testing/renderWithServices";
import { ThemePicker } from "./themePicker";

const root = document.documentElement;

afterEach(() => {
    cleanup();
    root.classList.remove("dark", "black");
    root.removeAttribute("data-palette");
    overwriteGetLocale(() => "en");
});

describe("ThemePicker", () => {
    it("opens on the default palette, following the system", () => {
        renderWithServices(<ThemePicker />);
        expect(chosen(m.settings_theme)).toBe(m.theme_system());
        expect(chosen(m.settings_palette)).toBe(m.palette_indigo());
    });

    it("saves and paints a mode, keeping the palette", () => {
        const theme = createThemeStore(memoryStore());
        renderWithServices(<ThemePicker />, { theme });
        choose(m.settings_theme, m.theme_black);
        expect(theme.load()).toEqual({ palette: "indigo", mode: "black" });
        expect(root.classList.contains("dark")).toBe(true);
        expect(root.classList.contains("black")).toBe(true);
        expect(chosen(m.settings_theme)).toBe(m.theme_black());
    });

    it("saves and paints a palette, keeping the mode", () => {
        const theme = createThemeStore(memoryStore());
        theme.save({ palette: "indigo", mode: "dark" });
        renderWithServices(<ThemePicker />, { theme });
        choose(m.settings_palette, m.palette_violet);
        expect(theme.load()).toEqual({ palette: "violet", mode: "dark" });
        expect(root.getAttribute("data-palette")).toBe("violet");
        expect(root.classList.contains("dark")).toBe(true);
    });

    it("offers every mode and palette in the reader's language", () => {
        overwriteGetLocale(() => "de");
        renderWithServices(<ThemePicker />);
        choose(m.settings_theme, m.theme_light);
        expect(chosen(m.settings_theme)).toBe(m.theme_light());
        choose(m.settings_palette, m.palette_violet);
        expect(chosen(m.settings_palette)).toBe(m.palette_violet());
    });
});
