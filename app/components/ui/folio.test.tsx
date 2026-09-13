// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Folio, FolioFigure, FolioRow } from "./folio";

vi.mock("../../paraglide/runtime.js", () => ({
    getLocale: () => "de",
    locales: ["en", "de"],
    localizeHref: (href: string) => `/de${href}`,
}));

afterEach(cleanup);

describe("FolioRow", () => {
    it("names itself as a heading at the level asked for, with its line and body", () => {
        render(
            <FolioRow heading="h2" name="Sound" line="Plinky can play notes" margin={<svg />}>
                <p>controls</p>
            </FolioRow>,
        );
        expect(screen.getByRole("heading", { level: 2, name: "Sound" })).toBeTruthy();
        expect(screen.getByText("Plinky can play notes")).toBeTruthy();
        expect(screen.getByText("controls")).toBeTruthy();
    });

    it("is one link, margin and all, when the whole row goes somewhere", () => {
        render(
            <MemoryRouter>
                <Folio>
                    <FolioRow to="/theory" name="How the music works" line="Short lessons" />
                </Folio>
            </MemoryRouter>,
        );
        const link = screen.getByRole("link", { name: /How the music works.*Short lessons/ });
        expect(link.getAttribute("href")).toBe("/de/theory/");
    });

    it("is a list item inside a Folio and a plain block on its own", () => {
        const { container } = render(
            <Folio label="Lessons">
                <FolioRow name="One" />
                <FolioRow name="Two" />
            </Folio>,
        );
        const list = screen.getByRole("list", { name: "Lessons" });
        expect(within(list).getAllByRole("listitem")).toHaveLength(2);
        cleanup();
        render(<FolioRow name="Alone" />);
        expect(screen.queryByRole("listitem")).toBeNull();
        expect(container.querySelector("li")).toBeNull();
    });

    it("puts an action at the end of its line", () => {
        render(<FolioRow name="A sitting" trailing={<button type="button">Remove</button>} />);
        expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
    });

    it("is ruled off by a hairline and never drawn as a box", () => {
        render(<FolioRow as="section" name="Sound" />);
        const row = screen.getByText("Sound").closest("section") as HTMLElement;
        expect(row.className).toContain("border-t");
        expect(row.className).not.toMatch(/\brounded|\bshadow|\bbg-/);
    });
});

describe("FolioFigure", () => {
    it("writes a number the way the reader's language does", () => {
        render(<FolioFigure value={12345} />);
        expect(screen.getByText("12.345")).toBeTruthy();
    });

    it("shows a figure already spelled out as it is", () => {
        render(<FolioFigure value="1 h 20 min" />);
        expect(screen.getByText("1 h 20 min")).toBeTruthy();
    });

    it("reads before the name it counts", () => {
        render(
            <Folio>
                <FolioRow margin={<FolioFigure value={46} />} name="Days you played" />
            </Folio>,
        );
        expect(screen.getByRole("listitem").textContent).toBe("46Days you played");
    });
});
