// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import type { HelpItem } from "../../core/help";
import { fakeHelp } from "../adapters/fakeHelp";
import { renderWithServices } from "../testing/renderWithServices";
import { m } from "../paraglide/messages.js";
import Help from "./help";

afterEach(cleanup);

const playItem: HelpItem = {
    id: "h-play",
    pageKey: "play",
    order: 0,
    text: "Press a key to play the note under the cursor.",
    imageUrl: "https://cdn.example.com/play.png",
    imageAlt: "The play screen",
    linkUrl: "https://plinky.fun/en/play",
};

describe("Help", () => {
    it("renders a published item under its page's section, with picture and link", async () => {
        renderWithServices(
            <MemoryRouter>
                <Help />
            </MemoryRouter>,
            { help: fakeHelp([playItem]) },
        );
        expect(await screen.findByText(playItem.text)).toBeTruthy();
        const img = screen.getByAltText("The play screen");
        expect(img.getAttribute("src")).toBe(playItem.imageUrl);
        expect(
            screen
                .getByText(/Learn more/)
                .closest("a")
                ?.getAttribute("href"),
        ).toBe(playItem.linkUrl);
    });

    it("gives each section an anchor id so the header ? can deep-link to it", () => {
        const { container } = renderWithServices(
            <MemoryRouter>
                <Help />
            </MemoryRouter>,
            { help: fakeHelp() },
        );
        for (const key of ["gettingStarted", "play", "library", "settings"]) {
            expect(container.querySelector(`#${key}`)).not.toBeNull();
        }
    });

    it("shows the empty note for a section with no published items", async () => {
        renderWithServices(
            <MemoryRouter>
                <Help />
            </MemoryRouter>,
            { help: fakeHelp([playItem]) },
        );
        // The Play section has the item; the others fall back to the empty note.
        await waitFor(() =>
            expect(screen.getAllByText("Help for this area is on the way.").length).toBeGreaterThan(
                0,
            ),
        );
    });

    it("keeps a door to the keyboard tour and the glossary", async () => {
        // The tour's only other link is the home checklist, which goes away once it is
        // dismissed or finished — so without this, /basics becomes unreachable and there
        // is no way back to it having forgotten where middle C was.
        renderWithServices(
            <MemoryRouter>
                <Help />
            </MemoryRouter>,
            { help: fakeHelp() },
        );

        expect(screen.getByRole("link", { name: m.basics_title() }).getAttribute("href")).toBe(
            "/en/basics/",
        );
        expect(screen.getByRole("link", { name: m.glossary_title() }).getAttribute("href")).toBe(
            "/en/glossary/",
        );
    });
});
