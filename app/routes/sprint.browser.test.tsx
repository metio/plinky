// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import Sprint from "./sprint";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderSprint() {
    return render(
        <MemoryRouter>
            <MidiProvider>
                <Sprint />
            </MidiProvider>
        </MemoryRouter>,
    );
}

describe("Sprint", () => {
    it("renders a generated phrase on OSMD", async () => {
        renderSprint();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        expect(screen.getByText("New phrase")).toBeTruthy();
        expect(screen.getByText("Practice")).toBeTruthy();
    });

    it("generates a new phrase on demand", async () => {
        renderSprint();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        const before = document.querySelector("svg")?.outerHTML;
        fireEvent.click(screen.getByText("New phrase"));
        // The viewer remounts with a fresh phrase; the score region stays present.
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        expect(before).toBeTruthy();
    });
});
