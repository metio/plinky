// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MidiProvider } from "../contexts/midi";
import type { Exercise } from "../lib/exercises";
import { RhythmTrainer } from "./rhythmTrainer";

// Stub the metronome: the audio-clock count-in does not advance headless, and the
// trainer arms after its own timeout, which a brisk tempo keeps short.
vi.mock("../hooks/useMetronome", () => ({
    useMetronome: () => ({
        running: false,
        beat: 0,
        startMetronome: () => {},
        countIn: () => {},
        setTempo: () => {},
        stop: () => {},
    }),
}));

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
        await new Promise((resolve) => setTimeout(resolve, 20));
    });
}

describe("RhythmTrainer", () => {
    it("arms after the count-in, scores the notes, and summarizes", async () => {
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

        // The trainer arms via its own setTimeout (one bar at tempo 480 ≈ 0.5s).
        await screen.findByText(/on the beat/, undefined, { timeout: 2000 });
        for (const note of [60, 62, 64, 65]) {
            await play(note);
        }

        expect(await screen.findByText(/Average timing error/)).toBeDefined();
    });
});
