// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import type { Exercise } from "../lib/exercises";
import { TempoTrainer } from "./tempoTrainer";

const exercise: Exercise = {
    id: "tempo-browser",
    title: "Tempo browser",
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
    });
}

describe("TempoTrainer", () => {
    it("times a run and reports a median tempo", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        mounted.push(container);
        render(
            <MidiProvider>
                <TempoTrainer exercise={exercise} />
            </MidiProvider>,
            { container },
        );

        const start = await screen.findByRole("button", { name: "Start" });
        await waitFor(() => expect(start).not.toBeDisabled());
        await act(async () => {
            fireEvent.click(start);
            await new Promise((resolve) => setTimeout(resolve, 30));
        });

        for (const note of [60, 62, 64, 65]) {
            await play(note);
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
            });
        }

        expect(await screen.findByText(/Median tempo/)).toBeDefined();
    });
});
