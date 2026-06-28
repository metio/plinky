// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import Compose from "./compose";

let mounted: HTMLElement[] = [];

afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
    localStorage.clear();
});

function mount() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    mounted.push(container);
    render(
        <MemoryRouter>
            <MidiProvider>
                <Compose />
            </MidiProvider>
        </MemoryRouter>,
        { container },
    );
    return container;
}

// Plays a held note through the test bridge, waiting between press and release so the
// recorded duration is positive.
async function strike(note: number) {
    await act(async () => {
        window.__plinky?.play(note);
        await new Promise((resolve) => setTimeout(resolve, 30));
        window.__plinky?.release(note);
    });
}

describe("Compose", () => {
    it("captures played notes, sketches a staff and checkpoints", async () => {
        mount();
        expect(await screen.findByRole("heading", { name: "Compose" })).toBeTruthy();

        await strike(60);
        await strike(64);

        // The note counter reflects what was captured.
        expect(await screen.findByText("2 notes")).toBeTruthy();
        // OSMD renders the sketch once the debounce fires.
        await waitFor(() => expect(document.querySelector("svg")).toBeTruthy(), { timeout: 30000 });

        // Set a checkpoint at two notes, play a third, then reset back to two.
        fireEvent.click(screen.getByRole("button", { name: "Set checkpoint" }));
        await strike(67);
        expect(await screen.findByText("3 notes")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /Reset to checkpoint/ }));
        expect(await screen.findByText("2 notes")).toBeTruthy();
    });

    it("loads a shared composition from the url", async () => {
        // ?c= is produced by encodeComposition; render under that search param.
        const { encodeComposition } = await import("../lib/composition");
        const code = encodeComposition({
            notes: [
                { pitch: 60, startMs: 0, durationMs: 400, velocity: 90 },
                { pitch: 62, startMs: 500, durationMs: 400, velocity: 90 },
            ],
            tempo: 120,
            beatsPerBar: 4,
        });
        const container = document.createElement("div");
        document.body.appendChild(container);
        mounted.push(container);
        render(
            <MemoryRouter initialEntries={[`/compose?c=${code}`]}>
                <MidiProvider>
                    <Compose />
                </MidiProvider>
            </MemoryRouter>,
            { container },
        );

        expect(await screen.findByText("2 notes")).toBeTruthy();
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), {
            timeout: 30000,
        });
    });

    it("loads notes from an opened MIDI file", async () => {
        const { toMidiNotes } = await import("../lib/composition");
        const { buildMidiFile } = await import("../lib/midiFile");
        const bytes = buildMidiFile(
            toMidiNotes({
                notes: [
                    { pitch: 60, startMs: 0, durationMs: 400, velocity: 90 },
                    { pitch: 64, startMs: 500, durationMs: 400, velocity: 90 },
                    { pitch: 67, startMs: 1000, durationMs: 400, velocity: 90 },
                ],
                tempo: 120,
                beatsPerBar: 4,
            }),
            { tempo: 120 },
        );
        const container = mount();
        const file = new File([bytes], "take.mid", { type: "audio/midi" });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { files: [file] } });
        });
        expect(await screen.findByText("3 notes")).toBeTruthy();
    });
});
