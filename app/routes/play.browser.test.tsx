// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import Play from "./play";
import type { Route } from "./+types/play";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderPlay(songId: string) {
    const props = { params: { songId } } as unknown as Route.ComponentProps;
    return render(
        <MemoryRouter>
            <MidiProvider>
                <Play {...props} />
            </MidiProvider>
        </MemoryRouter>,
    );
}

describe("Play", () => {
    it("renders the requested bundled piece", async () => {
        renderPlay("ode-to-joy");
        expect(await screen.findByText("Ode to Joy")).toBeTruthy();
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
    });

    it("reports a missing song", async () => {
        renderPlay("no-such-song");
        expect(await screen.findByText("That song isn't on this device.")).toBeTruthy();
    });
});
