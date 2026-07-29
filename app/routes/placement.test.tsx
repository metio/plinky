// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { memoryStore } from "../adapters/memoryStore";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import Placement from "./placement";

// OSMD only renders in a real browser, so the score itself is a stub here; what
// this covers is the surface around it — the ladder's state on screen, and the
// result being written once.
vi.mock("../components/features/scoreViewer", () => ({
    ScoreViewer: () => <div data-testid="score" />,
}));

afterEach(cleanup);

function mount(seed: Record<string, string> = {}) {
    const store = memoryStore(seed);
    const view = renderWithServices(
        <MemoryRouter>
            <Placement />
        </MemoryRouter>,
        { store },
    );
    return { store, ...view };
}

describe("Placement", () => {
    it("offers the test before it offers a score", () => {
        mount();

        expect(screen.getByRole("button", { name: m.placement_start() })).toBeTruthy();
        expect(screen.queryByRole("progressbar")).toBeNull();
    });

    it("shows the ladder once reading begins", () => {
        mount();

        fireEvent.click(screen.getByRole("button", { name: m.placement_start() }));

        expect(screen.getByText(m.placement_level({ level: 1 }))).toBeTruthy();
        expect(screen.getByText(m.placement_strikes({ used: 0, total: 3 }))).toBeTruthy();
        expect(screen.getByRole("progressbar")).toBeTruthy();
    });

    it("remembers the last result and offers another go", () => {
        mount({
            "plinky:placement": JSON.stringify({ rating: 900, grade: 3, takenAt: 1 }),
        });

        expect(screen.getByText(m.placement_last({ rating: 900, grade: 3 }))).toBeTruthy();
        expect(screen.getByRole("button", { name: m.placement_again() })).toBeTruthy();
    });

    it("keeps a device that has never been tested free of a result", () => {
        const { store } = mount();

        fireEvent.click(screen.getByRole("button", { name: m.placement_start() }));

        // Nothing is written until the ladder actually ends.
        expect(store.get("plinky:placement")).toBeNull();
    });
});
