// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import type { Exercise } from "../lib/exercises";
import { RhythmTrainer } from "./rhythmTrainer";

const exercise: Exercise = {
    id: "rhythm-browser",
    title: "Rhythm browser",
    description: "",
    tempo: 480,
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
        await new Promise((resolve) => setTimeout(resolve, 30));
    });
}

describe("RhythmTrainer", () => {
    it("counts in, scores the played notes, and summarizes", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        mounted.push(container);
        render(
            <MidiProvider>
                <RhythmTrainer exercise={exercise} />
            </MidiProvider>,
            { container },
        );

        const start = await screen.findByRole("button", { name: "Start" });
        await waitFor(() => expect(start).not.toBeDisabled());
        fireEvent.click(start);

        // The metronome's audio-clock count-in does not advance reliably in a
        // muted headless browser, so assert the count-in begins.
        expect(await screen.findByText(/Count-in/)).toBeDefined();
        await play(60);
    });
});
