// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { SprintTrainer } from "./sprintTrainer";

let mounted: HTMLElement[] = [];
afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

describe("SprintTrainer", () => {
    it("generates a phrase and arms on start", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        mounted.push(container);
        render(
            <MidiProvider>
                <SprintTrainer />
            </MidiProvider>,
            { container },
        );

        await act(async () => {
            fireEvent.click(await screen.findByRole("button", { name: "Start sprint" }));
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // Once armed, the score is generated and the trainer prompts for the first note.
        await waitFor(() => expect(screen.getByText(/to start/)).toBeDefined());
    });
});
