// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
        expect(
            screen.getByRole("heading", { level: 1, name: "Datenschutzerklärung" }),
        ).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Verantwortlicher" })).toBeTruthy();
        expect(screen.getByText(/Bremer Platz 7/)).toBeTruthy();
        // The processing actually described: hosting/logs, local storage, and rights.
        expect(screen.getByRole("heading", { name: /Server-Logfiles/ })).toBeTruthy();
        expect(screen.getByRole("heading", { name: /Lokale Speicherung/ })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Deine Rechte" })).toBeTruthy();
    });
});
