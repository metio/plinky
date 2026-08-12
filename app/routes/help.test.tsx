// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { paragraphs } from "../../core/help";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import Help from "./help";

afterEach(cleanup);

// The page links out to the glossary and friends, so it needs a router around it.
const show = () =>
    renderWithServices(
        <MemoryRouter initialEntries={["/en/help/"]}>
            <Help />
        </MemoryRouter>,
    );

describe("the help page", () => {
    it("shows every section, with its text, straight from the build", () => {
        show();
        // A section for each page of the app, each headed by its own name.
        expect(screen.getByRole("heading", { name: m.help_section_welcome() })).toBeTruthy();
        expect(screen.getByRole("heading", { name: m.help_section_extras() })).toBeTruthy();
        expect(screen.getByRole("heading", { name: m.nav_settings() })).toBeTruthy();

        // …and the words themselves, with no fetch and no loading state to wait on.
        const [first] = paragraphs(m.help_text_intro());
        expect(screen.getByText(first as string)).toBeTruthy();
    });

    it("gives each section an anchor the header's ? can land on", () => {
        const { container } = show();
        for (const key of ["intro", "gettingStarted", "play", "settings", "extras"]) {
            expect(container.querySelector(`#${key}`)).toBeTruthy();
        }
    });

    it("shows the picture of the page a section describes", () => {
        show();
        const shot = screen.getByAltText(m.help_shot_settings());
        // Served from our own tree, not from anybody else's server.
        expect(shot.getAttribute("src")).toBe("/help/settings.webp");
        expect(shot.getAttribute("loading")).toBe("lazy");
    });

    it("splits a section's text into paragraphs on blank lines", () => {
        // The message holds several paragraphs; each becomes its own element rather
        // than one block of run-together prose.
        const wanted = paragraphs(m.help_text_getting_started());
        expect(wanted.length).toBeGreaterThan(1);
        show();
        for (const para of wanted) {
            expect(screen.getByText(para)).toBeTruthy();
        }
    });

    it("still points at the glossary, theory, tools and the keyboard tour", () => {
        show();
        expect(screen.getByRole("link", { name: m.glossary_title() })).toBeTruthy();
        expect(screen.getByRole("link", { name: m.theory_title() })).toBeTruthy();
        expect(screen.getByRole("link", { name: m.tools_title() })).toBeTruthy();
        expect(screen.getByRole("link", { name: m.basics_title() })).toBeTruthy();
    });
});

describe("paragraphs", () => {
    it("splits on blank lines and trims", () => {
        expect(paragraphs("one\n\n  two  \n\n\nthree")).toEqual(["one", "two", "three"]);
    });

    it("returns nothing for text that is only whitespace", () => {
        expect(paragraphs("   \n\n  ")).toEqual([]);
    });

    it("keeps a single paragraph whole, newlines and all", () => {
        expect(paragraphs("a line\nand another")).toEqual(["a line\nand another"]);
    });
});
