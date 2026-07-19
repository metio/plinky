// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import About from "./about";

afterEach(cleanup);

describe("About", () => {
    it("introduces both founders with their portraits", () => {
        renderWithServices(<About />);
        const sol = screen.getByAltText("Sol Herrera");
        const sebastian = screen.getByAltText("Sebastian Hoß");
        expect(sol.getAttribute("src")).toBe("/founder-marisol.webp");
        expect(sebastian.getAttribute("src")).toBe("/founder-sebastian.webp");
    });

    it("gives each founder their title in their own language", () => {
        renderWithServices(<About />);
        expect(screen.getByText("La Jefa")).toBeTruthy();
        expect(screen.getByText("der Architekt")).toBeTruthy();
    });

    it("plays the peck when Sol's portrait is tapped", () => {
        renderWithServices(<About />);
        expect(screen.getByAltText("Sol Herrera").className).not.toContain("animate-smooch");
        // Sol's portrait is a button (its name comes from the image alt).
        fireEvent.click(screen.getByRole("button", { name: "Sol Herrera" }));
        expect(screen.getByAltText("Sol Herrera").className).toContain("animate-smooch");
        expect(screen.getByAltText("Sebastian Hoß").className).toContain("animate-lean");
    });

    it("tells why Plinky was made and how to get in touch", () => {
        renderWithServices(<About />);
        expect(screen.getByRole("heading", { name: m.about_why_title() })).toBeTruthy();
        expect(screen.getByText(m.about_why_body())).toBeTruthy();
        expect(screen.getByRole("heading", { name: m.about_contact_title() })).toBeTruthy();
        expect(screen.getByRole("link", { name: "contact@plinky.fun" }).getAttribute("href")).toBe(
            "mailto:contact@plinky.fun",
        );
    });
});
