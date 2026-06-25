// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import Daily from "./daily";

// OSMD renders only in a real browser, so this runs in the browser project.
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("Daily", () => {
    it("heads the page with the running challenge number", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Daily />
                </MidiProvider>
            </MemoryRouter>,
        );
        expect(await screen.findByText(/Plinky #\d+/)).toBeTruthy();
    });

    it("renders today's deterministic score", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <Daily />
                </MidiProvider>
            </MemoryRouter>,
        );
        // The chosen piece renders through the graded score viewer.
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        expect(screen.getByText(/Listen/)).toBeTruthy();
        expect(screen.getByText("Practice")).toBeTruthy();
    });
});
