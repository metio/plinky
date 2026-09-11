// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { overwriteGetLocale } from "../../paraglide/runtime.js";
import { ThemeToggle } from "./themeToggle";

afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    overwriteGetLocale(() => "en");
});

describe("ThemeToggle", () => {
    it("cycles system → light → dark, persisting and applying each", () => {
        render(<ThemeToggle />);
        const button = screen.getByRole("button");
        expect(button.textContent).toContain("System");

        fireEvent.click(button);
        expect(button.textContent).toContain("Light");
        expect(localStorage.getItem("plinky:theme")).toBe('"light"');

        fireEvent.click(button);
        expect(button.textContent).toContain("Dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("names each theme in the reader's language, with no emoji to read aloud", () => {
        overwriteGetLocale(() => "de");
        render(<ThemeToggle />);

        for (const name of [m.theme_system, m.theme_light, m.theme_dark]) {
            const button = screen.getByRole("button", { name: m.theme_aria({ theme: name() }) });
            const label = button.getAttribute("aria-label") ?? "";
            expect(label).not.toMatch(/\p{Extended_Pictographic}/u);
            expect(label).not.toMatch(/\b(system|light|dark)\b/);
            // The visible label still leads with the theme's picture.
            expect(button.textContent).toContain(name());
            fireEvent.click(button);
        }
    });
});
