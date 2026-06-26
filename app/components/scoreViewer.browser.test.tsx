// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import { generatePhrase } from "../lib/generator";
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
});
