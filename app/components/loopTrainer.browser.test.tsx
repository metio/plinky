// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import type { Exercise } from "../lib/exercises";
import { LoopTrainer } from "./loopTrainer";

const exercise: Exercise = {
    id: "loop-browser",
    title: "Loop browser",
    description: "",
    tempo: 120,
    beatsPerBar: 4,
    abc: "X:1\nL:1/4\nK:C\nC D E F |",
};

let mounted: HTMLElement[] = [];
afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

async function play(note: number) {
    await act(async () => {
        window.__plinky?.play(note);
        await new Promise((resolve) => setTimeout(resolve, 40));
    });
}

describe("LoopTrainer", () => {
    it("logs a lap after playing the looped bars", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        mounted.push(container);
        render(
            <MidiProvider>
                <LoopTrainer exercise={exercise} />
            </MidiProvider>,
            { container },
        );

        const start = await screen.findByRole("button", { name: "Start looping" });
        await waitFor(() => expect(start).not.toBeDisabled());
        await act(async () => {
            fireEvent.click(start);
            await new Promise((resolve) => setTimeout(resolve, 30));
        });

        for (const note of [60, 62, 64, 65]) {
            await play(note);
        }

        // Finishing the region logs a lap; the summary shows "… · last … bpm".
        await waitFor(() => expect(screen.getByText(/· last/)).toBeDefined(), { timeout: 3000 });
    });
});
