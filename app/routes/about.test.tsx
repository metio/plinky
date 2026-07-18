// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import About from "./about";

afterEach(cleanup);

describe("About", () => {
    it("introduces both founders with their portraits", () => {
        renderWithServices(<About />);
        const marisol = screen.getByAltText("Marisol Herrera Rivero");
        const sebastian = screen.getByAltText("Sebastian Hoß");
        expect(marisol.getAttribute("src")).toBe("/founder-marisol.webp");
        expect(sebastian.getAttribute("src")).toBe("/founder-sebastian.webp");
    });

    it("gives Marisol her La Jefa title and Sebastian his role", () => {
        renderWithServices(<About />);
        expect(screen.getByText("La Jefa")).toBeTruthy();
        expect(screen.getByText(m.about_sebastian_role())).toBeTruthy();
    });

    it("tells why Plinky was made", () => {
        renderWithServices(<About />);
        expect(screen.getByRole("heading", { name: m.about_why_title() })).toBeTruthy();
        expect(screen.getByText(m.about_why_body())).toBeTruthy();
    });
});
