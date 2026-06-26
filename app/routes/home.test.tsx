// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./home";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderHome() {
    return render(
        <MemoryRouter>
            <Home />
        </MemoryRouter>,
    );
}

describe("Home", () => {
    it("always offers the no-score training modes", () => {
        renderHome();
        for (const label of ["Daily challenge →", "Ear training →"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it("routes into the library and the guided tracks", () => {
        renderHome();
        // Links are localized; the test setup pins the locale to the base.
        expect(screen.getByText("All scores →").closest("a")?.getAttribute("href")).toBe(
            "/en/library",
        );
        expect(screen.getByText("Tracks →").closest("a")?.getAttribute("href")).toBe("/en/tracks");
    });
});
