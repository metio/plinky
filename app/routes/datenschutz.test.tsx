// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import Datenschutz, { meta } from "./datenschutz";

afterEach(cleanup);

describe("Datenschutzerklärung meta", () => {
    it("keeps the privacy policy out of the search index", () => {
        const tags = meta({} as Parameters<typeof meta>[0]) as Record<string, string>[];
        expect(tags).toContainEqual({ name: "robots", content: "noindex, follow" });
    });
});

describe("Datenschutzerklärung", () => {
    it("names the controller and covers the key processing sections", () => {
        renderWithServices(<Datenschutz />);
        expect(screen.getByRole("heading", { level: 1, name: m.datenschutz_title() })).toBeTruthy();
        expect(
            screen.getByRole("heading", { name: m.datenschutz_controller_heading() }),
        ).toBeTruthy();
        expect(screen.getByText(/Bremer Platz 7/)).toBeTruthy();
        // The processing actually described: hosting/logs, local storage, and rights.
        expect(screen.getByRole("heading", { name: m.datenschutz_hosting_heading() })).toBeTruthy();
        expect(
            screen.getByRole("heading", { name: m.datenschutz_localstorage_heading() }),
        ).toBeTruthy();
        expect(screen.getByRole("heading", { name: m.datenschutz_rights_heading() })).toBeTruthy();
    });

    it("shows the machine-translation notice on a non-German locale, linking to the original", () => {
        // The shared test setup pins getLocale to the base locale (en), so the page
        // renders a translation and carries the notice back to the German original.
        renderWithServices(<Datenschutz />);
        const link = screen.getByRole("link", { name: m.legal_mt_view_original() });
        expect(link.getAttribute("href")).toBe("/de/datenschutz");
    });
});
