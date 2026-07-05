// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./themeToggle";

afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
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
});
