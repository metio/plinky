// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { generatePhrase } from "../lib/generator";
import { saveGhost } from "../lib/recording";
import { GHOST_COLOR, PLAYED_COLOR } from "../lib/scoreColor";
import { ScoreViewer } from "./scoreViewer";

const mount = (xml: string, props: Partial<{ beatsPerBar: number }> = {}) =>
    render(
        <MemoryRouter>
            <MidiProvider>
                <ScoreViewer id="t" xml={xml} title="T" {...props} />
            </MidiProvider>
        </MemoryRouter>,
    );

// OSMD renders only in a real browser, so this runs in the browser project.
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("ScoreViewer", () => {
    it("surfaces an error instead of a silently dead viewer when OSMD can't load", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer id="broken" xml="this is not MusicXML" title="Broken" />
                </MidiProvider>
            </MemoryRouter>,
        );
        // A score OSMD can't parse must report rather than leave the controls
        // disabled forever with no explanation.
        expect(
            await screen.findByText(/couldn't be displayed/, undefined, { timeout: 8000 }),
        ).toBeTruthy();
    });

    it("toggles the metronome on and off without crashing", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer id="x" xml="this is not MusicXML" title="X" beatsPerBar={3} />
                </MidiProvider>
            </MemoryRouter>,
        );
        const button = await screen.findByText(/Metronome/);
        expect(button.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(button);
        expect(button.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(button);
        expect(button.getAttribute("aria-pressed")).toBe("false");
    });

    it("reveals the adaptive toggle only while the metronome is on", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer id="a" xml="this is not MusicXML" title="A" />
                </MidiProvider>
            </MemoryRouter>,
        );
        const metronome = await screen.findByText(/Metronome/);
        expect(screen.queryByText("Adaptive")).toBeNull();
        fireEvent.click(metronome);
        const adaptive = screen.getByText("Adaptive");
        expect(adaptive.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(adaptive);
        expect(adaptive.getAttribute("aria-pressed")).toBe("true");
        // Turning the metronome off hides the adaptive control again.
        fireEvent.click(metronome);
        expect(screen.queryByText("Adaptive")).toBeNull();
    });

    it("colours notes on the score as they are played", async () => {
        // A one-bar phrase whose every note is the first scale degree (C5), so the
        // same key clears each position in turn.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        const { container } = mount(phrase, { beatsPerBar: 4 });
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        fireEvent.click(await screen.findByText(/Practice/));
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        // Played noteheads are recoloured in the rendered SVG — this exercises the
        // real OSMD graphical-note → SVG path the colouring depends on.
        await waitFor(
            () => expect(container.querySelector(`[fill="${PLAYED_COLOR}"]`)).toBeTruthy(),
            {
                timeout: 4000,
            },
        );
    });

    it("shows a ghost to race once a previous run is saved", async () => {
        // mount() renders with id "t"; a saved ghost for it is loaded on Practice.
        saveGhost("t", [0, 500, 1000]);
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        const { container } = mount(phrase, { beatsPerBar: 4 });
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
        fireEvent.click(await screen.findByText(/Practice/));
        // The race track appears...
        expect(await screen.findByRole("img", { name: /race/i })).toBeTruthy();
        // ...and the ghost colours its current note on the rendered staff.
        await waitFor(
            () => expect(container.querySelector(`[fill="${GHOST_COLOR}"]`)).toBeTruthy(),
            { timeout: 4000 },
        );
    });

    it("adopts a ghost from a link and offers to pass it on", async () => {
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        render(
            <MemoryRouter initialEntries={["/play/t?ghost=0.500.1000"]}>
                <MidiProvider>
                    <ScoreViewer id="t" xml={phrase} title="T" beatsPerBar={4} canShareGhost />
                </MidiProvider>
            </MemoryRouter>,
        );
        expect(await screen.findByText(/racing a shared ghost/i)).toBeTruthy();
        expect(screen.getByText(/Challenge a friend/)).toBeTruthy();
    });

    it("offers a hands-separate selector only for a grand staff", async () => {
        const grand = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: true }, () => 0.5);
        mount(grand, { beatsPerBar: 4 });
        // The selector appears once OSMD reports two staves; its three options name
        // the hands. This also exercises the OSMD staff API the matcher filters on.
        expect(await screen.findByText("Right", undefined, { timeout: 8000 })).toBeTruthy();
        expect(screen.getByText("Left")).toBeTruthy();
        expect(screen.getByText("Both")).toBeTruthy();
    });

    it("omits the hands selector for a single-staff score", async () => {
        const single = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(single, { beatsPerBar: 4 });
        // Wait until the score is interactive (Listen enabled), then confirm the
        // single-staff piece offers no hand choice.
        const listen = await screen.findByText(/Listen/, undefined, { timeout: 8000 });
        await expect.poll(() => (listen as HTMLButtonElement).disabled).toBe(false);
        expect(screen.queryByText("Right")).toBeNull();
        expect(screen.queryByText("Left")).toBeNull();
    });

    it("reveals the section-loop bar inputs only once looping is on", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        const loop = await screen.findByText(/Loop/, undefined, { timeout: 8000 });
        expect(loop.getAttribute("aria-pressed")).toBe("false");
        expect(screen.queryByLabelText("Loop from bar")).toBeNull();
        fireEvent.click(loop);
        expect(loop.getAttribute("aria-pressed")).toBe("true");
        // The range seeds to the whole piece — OSMD reported three bars.
        const to = screen.getByLabelText("Loop to bar") as HTMLInputElement;
        expect(to.value).toBe("3");
    });

    it("never lets the loop range invert", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await screen.findByText(/Loop/, undefined, { timeout: 8000 }));
        const from = screen.getByLabelText("Loop from bar") as HTMLInputElement;
        const to = screen.getByLabelText("Loop to bar") as HTMLInputElement;
        fireEvent.change(to, { target: { value: "2" } });
        expect(to.value).toBe("2");
        // Pushing the start past the end drags the end along instead of inverting.
        fireEvent.change(from, { target: { value: "3" } });
        expect(from.value).toBe("3");
        expect(to.value).toBe("3");
    });

    it("omits the section-loop control for a single-bar score", async () => {
        const single = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(single, { beatsPerBar: 4 });
        const listen = await screen.findByText(/Listen/, undefined, { timeout: 8000 });
        await expect.poll(() => (listen as HTMLButtonElement).disabled).toBe(false);
        expect(screen.queryByText(/Loop/)).toBeNull();
    });
});
