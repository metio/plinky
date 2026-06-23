// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import type { Exercise } from "../lib/exercises";
import { SightReadingTrainer } from "./sightReadingTrainer";

// A real browser is needed: abcjs only fills in note pitches when it renders into
// a live document, and the window bridge lets us play notes as a MIDI device would.
const exercise: Exercise = {
    id: "browser-test",
    title: "Browser test",
    description: "",
    tempo: 100,
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

function mount() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    mounted.push(container);
    render(
        <MidiProvider>
            <SightReadingTrainer exercise={exercise} />
        </MidiProvider>,
        { container },
    );
}

// Wait for abcjs to render, the hands to build, and the matcher's state reset to
// settle, so notes play against the populated phrase rather than a half-set-up one.
async function ready() {
    await waitFor(() =>
        expect(screen.getByText(/Progress:/).parentElement?.textContent).toContain("/ 4"),
    );
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
    });
}

async function play(note: number) {
    await act(async () => {
        window.__plinky?.play(note);
    });
}

describe("SightReadingTrainer", () => {
    it("advances through the phrase and completes as the notes are played", async () => {
        mount();
        await ready();
        for (const note of [60, 62, 64, 65]) {
            await play(note);
        }
        expect(await screen.findByText(/Complete/)).toBeDefined();
        expect(screen.getByText(/Progress:/).parentElement?.textContent).toContain("4 / 4");
    });

    it("flags a wrong note without advancing", async () => {
        mount();
        await ready();
        await play(61); // C# — no hand expects it
        expect(await screen.findByText(/✗/)).toBeDefined();
        expect(screen.getByText(/Progress:/).parentElement?.textContent).toContain("0 / 4");
    });
});
