// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { ComposerCredit, composerCreditText } from "./composerCredit";

afterEach(cleanup);

function show(composer: string) {
    const router = createMemoryRouter(
        [{ path: "/*", element: <ComposerCredit composer={composer} /> }],
        { initialEntries: ["/en/music"] },
    );
    render(<RouterProvider router={router} />);
}

describe("ComposerCredit", () => {
    it("links a composer to their page", () => {
        show("Ludwig van Beethoven");

        const link = screen.getByRole("link", { name: "Ludwig van Beethoven" });
        expect(link.getAttribute("href")).toContain("/person/ludwig-van-beethoven");
    });

    it("gives each person in a shared credit their own link", () => {
        // What this replaces: the joined string printed whole, linked to whichever name
        // came first, so the second composer could not be reached from their own piece.
        show("Bartholomäus Gesius / Georg Philipp Telemann");

        expect(
            screen.getByRole("link", { name: "Bartholomäus Gesius" }).getAttribute("href"),
        ).toContain("/person/bartholomaus-gesius");
        expect(
            screen.getByRole("link", { name: "Georg Philipp Telemann" }).getAttribute("href"),
        ).toContain("/person/georg-philipp-telemann");
        expect(screen.queryByText(/Gesius \/ Georg/)).toBeNull();
    });

    it("splits an ampersand credit the same way", () => {
        show("Manaka Tominaga & Shiho Fujii & Kazumi Totaka");

        expect(screen.getAllByRole("link")).toHaveLength(3);
    });

    it("cleans a credit that arrived with a work number welded to it", () => {
        show("Johann Friedrich Franz Burgmüller Opus 100.");

        expect(
            screen.getByRole("link", { name: "Johann Friedrich Franz Burgmüller" }),
        ).toBeTruthy();
    });

    it("names a tradition without linking it anywhere", () => {
        show("Traditional");

        expect(screen.queryByRole("link")).toBeNull();
        expect(screen.getByText("Traditional")).toBeTruthy();
    });

    it("renders nothing for an empty credit", () => {
        const { container } = render(<ComposerCredit composer="" />);

        expect(container.textContent).toBe("");
    });
});

describe("composerCreditText", () => {
    it("cleans the credit the places that cannot hold an element get", () => {
        // A meta description, structured data and the credit burnt into an exported
        // video all carried the raw string, so a piece whose page read one name was
        // described to a search engine under another.
        expect(composerCreditText("Johann Friedrich Franz Burgmüller Opus 100.")).toBe(
            "Johann Friedrich Franz Burgmüller",
        );
    });

    it("names every person in a shared credit", () => {
        expect(composerCreditText("Bartholomäus Gesius / Georg Philipp Telemann")).toBe(
            "Bartholomäus Gesius, Georg Philipp Telemann",
        );
    });

    it("is empty for an empty credit", () => {
        expect(composerCreditText("")).toBe("");
    });
});
