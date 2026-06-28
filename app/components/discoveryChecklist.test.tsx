// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { DiscoveryChecklist } from "./discoveryChecklist";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function mount() {
    return render(
        <MemoryRouter>
            <DiscoveryChecklist />
        </MemoryRouter>,
    );
}

describe("DiscoveryChecklist", () => {
    it("offers a brand-new player the tour with its feature steps", async () => {
        // Empty device → nothing discovered yet → the checklist shows.
        mount();
        expect(await screen.findByText("Explore Plinky")).toBeTruthy();
        expect(screen.getByRole("link", { name: /Record your own tune/i })).toBeTruthy();
    });

    it("dismisses for good when the ✕ is clicked", async () => {
        mount();
        await screen.findByText("Explore Plinky");
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        await waitFor(() => expect(screen.queryByText("Explore Plinky")).toBeNull());
        // The dismissal persists, so it stays gone on the next visit.
        expect(localStorage.getItem("plinky:seen-hints")).toContain("discovery-panel");
    });

    it("stays hidden for a player who has already dismissed it", async () => {
        localStorage.setItem("plinky:seen-hints", JSON.stringify(["discovery-panel"]));
        mount();
        // Give the post-mount read a chance to run, then confirm it never appears.
        await waitFor(() => expect(screen.queryByText("Explore Plinky")).toBeNull());
    });
});
