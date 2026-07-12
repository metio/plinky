// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { fakeMidi } from "../adapters/fakeMidi";
import { ServicesProvider } from "../contexts/services";
import Compose from "./compose";

let mounted: HTMLElement[] = [];

// The browser context arrives with MIDI pre-granted; without a fake seam the
// provider would silently open a REAL Web MIDI connection under every test.
const midiFake = { midi: fakeMidi() };

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
            <ServicesProvider services={midiFake}>
                <MidiProvider>
                    <Compose />
                </MidiProvider>
            </ServicesProvider>
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
        const { encodeComposition } = await import("../../core/composition");
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
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Compose />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
            { container },
        );

        expect(await screen.findByText("2 notes")).toBeTruthy();
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), {
            timeout: 30000,
        });
    });

    it("asks before Clear wipes the take", async () => {
        mount();
        await strike(60);
        await strike(64);
        expect(await screen.findByText("2 notes")).toBeTruthy();
        // First click only arms — a misclick mustn't destroy the recording.
        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
        expect(screen.getByText("2 notes")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Clear all?" }));
        expect(await screen.findByText("0 notes")).toBeTruthy();
    });

    it("confirms before an opened file replaces a non-empty take", async () => {
        const { toMidiNotes } = await import("../../core/composition");
        const { buildMidiFile } = await import("../../core/midiFile");
        const bytes = buildMidiFile(
            toMidiNotes({
                notes: [
                    { pitch: 62, startMs: 0, durationMs: 400, velocity: 90 },
                    { pitch: 65, startMs: 500, durationMs: 400, velocity: 90 },
                ],
                tempo: 120,
                beatsPerBar: 4,
            }),
            { tempo: 120 },
        );
        const container = mount();
        await strike(60);
        expect(await screen.findByText("1 notes")).toBeTruthy();
        const file = new File([bytes], "take.mid", { type: "audio/midi" });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { files: [file] } });
        });
        // The in-progress take is held, not silently overwritten…
        expect(await screen.findByText(/Replace your current recording/)).toBeTruthy();
        expect(screen.getByText("1 notes")).toBeTruthy();
        // …until the player confirms the replace.
        fireEvent.click(screen.getByRole("button", { name: "Replace" }));
        expect(await screen.findByText("2 notes")).toBeTruthy();
    });

    it("loads notes from an opened MIDI file", async () => {
        const { toMidiNotes } = await import("../../core/composition");
        const { buildMidiFile } = await import("../../core/midiFile");
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

    it("silences the recording metronome when leaving full screen", async () => {
        mount();
        // Count in drops into full screen and, after one bar, leaves the
        // metronome clicking for the recording.
        fireEvent.click(screen.getByRole("button", { name: "Count in" }));
        const metronome = screen.getByRole("switch", { name: "Metronome" });
        await waitFor(() => expect(metronome.getAttribute("aria-checked")).toBe("true"), {
            timeout: 5000,
        });

        // Stepping back out must end the click too, not leave it ticking at rest.
        fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
        await waitFor(() => expect(metronome.getAttribute("aria-checked")).toBe("false"));
    });

    it("cancels a pending count-in when the take is cleared", async () => {
        mount();
        await strike(60);
        fireEvent.click(screen.getByRole("button", { name: "Count in" }));
        expect(await screen.findByRole("button", { name: /Counting in/ })).toBeTruthy();
        // Clearing (two-step) must drop the pending count-in immediately, not leave its
        // timeout to fire later and re-anchor the clock / turn the metronome on. Read
        // synchronously: with the bug the flag only clears when the timeout fires ~1s on.
        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
        fireEvent.click(screen.getByRole("button", { name: "Clear all?" }));
        expect(screen.getByRole("button", { name: "Count in" })).toBeTruthy();
    });
});
