// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { HelpItem } from "../../core/help";
import { fakeHelp } from "../adapters/fakeHelp";
import { renderWithServices } from "../testing/renderWithServices";
import Help from "./help";

afterEach(cleanup);

const playItem: HelpItem = {
    id: "h-play",
    pageKey: "play",
    order: 0,
    text: "Press a key to play the note under the cursor.",
    imageUrl: "/help/play.png",
    imageAlt: "The play screen",
};

describe("Help", () => {
    it("renders an item under its page's section, with its picture", async () => {
        renderWithServices(<Help />, { help: fakeHelp([playItem]) });
        expect(await screen.findByText(playItem.text)).toBeTruthy();
        const img = screen.getByAltText("The play screen");
        expect(img.getAttribute("src")).toBe(playItem.imageUrl);
    });

    it("gives each section an anchor id so the header ? can deep-link to it", () => {
        const { container } = renderWithServices(<Help />, { help: fakeHelp() });
        for (const key of ["gettingStarted", "play", "library", "settings"]) {
            expect(container.querySelector(`#${key}`)).not.toBeNull();
        }
    });

    it("shows the empty note for a section with no published items", async () => {
        renderWithServices(<Help />, { help: fakeHelp([playItem]) });
        // The Play section has the item; the others fall back to the empty note.
        await waitFor(() =>
            expect(screen.getAllByText("Help for this area is on the way.").length).toBeGreaterThan(
                0,
            ),
        );
    });
});
