// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { EAR_NOTES } from "../lib/ear";
import { EarTrainer } from "./earTrainer";

let mounted: HTMLElement[] = [];
const originalRandom = Math.random;

beforeEach(() => {
    // Seed the target to the first pool note (C) so the test knows what to play.
    Math.random = () => 0;
});
afterEach(() => {
    Math.random = originalRandom;
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

describe("EarTrainer", () => {
    it("scores a correct answer", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        mounted.push(container);
        render(
            <MidiProvider>
                <EarTrainer />
            </MidiProvider>,
            { container },
        );

        fireEvent.click(await screen.findByRole("button", { name: /Start ear training/ }));
        await act(async () => {
            window.__plinky?.play(EAR_NOTES[0]!); // C, the seeded target
        });

        expect(await screen.findByText(/It was/)).toBeDefined();
        expect(screen.getByText(/correct/).textContent).toContain("1/1");
    });
});
