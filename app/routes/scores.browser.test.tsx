// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import Scores from "./scores";

// OSMD only renders in a real browser, so this runs in the browser project.
afterEach(cleanup);

function renderScores() {
    return render(
        <MemoryRouter>
            <Scores />
        </MemoryRouter>,
    );
}

describe("Scores", () => {
    it("lists the bundled scores and renders the selected one with OSMD", async () => {
        renderScores();
        expect(await screen.findByText("Ode to Joy")).toBeTruthy();
        expect(screen.getByText("Twinkle, Twinkle, Little Star")).toBeTruthy();
        // OSMD draws the selected score as an SVG.
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });

        // Selecting another score re-renders the viewer.
        fireEvent.click(screen.getByText("Twinkle, Twinkle, Little Star"));
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
    });

    it("plays and stops the selected score", async () => {
        renderScores();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        fireEvent.click(screen.getByText(/Listen/));
        await waitFor(() => expect(screen.getByText(/Stop/)).toBeTruthy());
        fireEvent.click(screen.getByText(/Stop/));
        await waitFor(() => expect(screen.getByText(/Listen/)).toBeTruthy());
    });
});
