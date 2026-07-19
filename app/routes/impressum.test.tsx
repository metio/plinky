// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithServices } from "../testing/renderWithServices";
import Impressum, { meta } from "./impressum";

afterEach(cleanup);

describe("Impressum meta", () => {
    it("keeps the legal notice out of the search index", () => {
        const tags = meta({} as Parameters<typeof meta>[0]) as Record<string, string>[];
        expect(tags).toContainEqual({ name: "robots", content: "noindex, follow" });
    });
});

describe("Impressum", () => {
    it("names the operator with a reachable address and email", () => {
        renderWithServices(<Impressum />);
        expect(screen.getByRole("heading", { level: 1, name: "Impressum" })).toBeTruthy();
        // The § 5 DDG essentials: name, postal address, and contact. The name appears
        // both in the address block and the content-responsible line.
        expect(screen.getAllByText(/Sebastian Hoß/).length).toBeGreaterThan(0);
        expect(screen.getByText(/Bremer Platz 7/)).toBeTruthy();
        expect(screen.getByText(/48155 Münster/)).toBeTruthy();
        const email = screen.getByRole("link", { name: "contact@plinky.fun" });
        expect(email.getAttribute("href")).toBe("mailto:contact@plinky.fun");
    });
});
