// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePhrase } from "../../../core/generator";
import { PLAYED_COLOR } from "../../../core/scoreCanvas";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { ScoreViewer } from "./scoreViewer";

// These are the desktop `browser` project's own passing assertions — the Runs drawer, loop
// bar-selection, played-note colouring and the finish-run/leave-full-screen flow — re-run
// under the phone profile (390×844, coarse pointer, touch). The desktop project already runs
// at phone *width* but with a fine pointer and no touch, so anything that only breaks here
// is a genuine mobile regression: a coarse-pointer branch, a touch-vs-mouse path, or an
// isMobile behaviour the desktop gate can never exercise.

// The browser context arrives with MIDI pre-granted; without a fake seam the provider would
// silently open a real Web MIDI connection under every test.
const midiFake = { midi: fakeMidi() };

// The Runs tab lives with the route (the mode bar), so the harness mirrors that
// wiring: the Runs button switches the view in place.
function Harness({ xml, ...props }: { xml: string; beatsPerBar?: number }) {
    const [runsView, setRunsView] = useState(false);
    return (
        <ScoreViewer
            id="t"
            xml={xml}
            title="T"
            runsView={runsView}
            onShowRuns={() => setRunsView(true)}
            onShowScore={() => setRunsView(false)}
            {...props}
        />
    );
}

const mount = (xml: string, props: Partial<{ beatsPerBar: number }> = {}) =>
    render(
        <MemoryRouter>
            <ServicesProvider services={midiFake}>
                <MidiProvider>
                    <Harness xml={xml} {...props} />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );

const awaitReady = async () => {
    const practice = await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
    // The default expect.poll timeout is 1s — far too short for OSMD's cold render under the
    // istanbul-instrumented coverage run, where the Practice button stays disabled for many
    // seconds. Match the 30s the rest of the suite's waits use.
    await expect
        .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000, interval: 100 })
        .toBe(false);
    return practice;
};

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("ScoreViewer on a phone", () => {
    it("opens the Runs view from the resting action row", async () => {
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        await awaitReady();
        fireEvent.click(screen.getByRole("button", { name: "Runs" }));
        expect(await screen.findByText(/play a piece through/i)).toBeTruthy();
    });

    it("puts the cursor at a tapped bar while the loop is off, to start from there", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        const score = await screen.findByRole("img", { name: "T" });
        const svg = await waitFor(
            () => {
                const rendered = score.querySelector("svg");
                if (!rendered || rendered.querySelectorAll("g").length === 0) {
                    throw new Error("not rendered yet");
                }
                return rendered;
            },
            { timeout: 30000 },
        );
        await waitFor(
            () => {
                const rect = svg.getBoundingClientRect();
                const at = {
                    clientX: rect.left + rect.width * 0.3,
                    clientY: rect.top + rect.height * 0.5,
                };
                // A genuine tap on the score: the pointer press arms the click.
                fireEvent.pointerDown(score, at);
                fireEvent.click(score, at);
                // The tap claims no loop — it shows the cursor at the bar instead, the
                // start position the next Practice or Listen resumes from.
                const cursor = document.querySelector('img[id^="cursorImg"]');
                if (!(cursor instanceof HTMLImageElement) || cursor.style.display === "none") {
                    throw new Error("cursor not shown yet");
                }
            },
            { timeout: 30000 },
        );
        expect(screen.queryByLabelText("Loop from bar")).toBeNull();
        expect(score.querySelectorAll("rect.plinky-bar-selection")).toHaveLength(0);
    });

    it("narrows the loop to a tapped bar, filling it with a red overlay", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        const score = await screen.findByRole("img", { name: "T" });
        const svg = await waitFor(
            () => {
                const rendered = score.querySelector("svg");
                if (!rendered || rendered.querySelectorAll("g").length === 0) {
                    throw new Error("not rendered yet");
                }
                return rendered;
            },
            { timeout: 30000 },
        );
        // With the loop on (whole song), a tap narrows the range to the tapped bar.
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        fireEvent.click(screen.getByRole("switch", { name: "Loop" }));
        await waitFor(
            () => {
                const rect = svg.getBoundingClientRect();
                const at = {
                    clientX: rect.left + rect.width * 0.3,
                    clientY: rect.top + rect.height * 0.5,
                };
                // A genuine tap on the score: the pointer press arms the click.
                fireEvent.pointerDown(score, at);
                fireEvent.click(score, at);
                // The whole-song 1–3 range narrows to the single tapped bar.
                const from = screen.getByLabelText("Loop from bar") as HTMLInputElement;
                const to = screen.getByLabelText("Loop to bar") as HTMLInputElement;
                expect(to.value).toBe(from.value);
            },
            { timeout: 30000 },
        );
        const fills = score.querySelectorAll("rect.plinky-bar-selection");
        expect(fills.length).toBeGreaterThan(0);
        expect(fills[0]?.getAttribute("fill")).toBe("#ef4444");
    });

    it("does not build a loop from a retargeted click when a run finishes", async () => {
        // On a touch device the tap that completes the run lands on the on-screen keyboard,
        // but its compatibility click retargets to the score once the keyboard unmounts and
        // the score reclaims that space — a click with no pointer press on the score. That
        // must not silently build a one-bar loop the player never asked for.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const phrase = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, () => 0);
        const score = mount(phrase, { beatsPerBar: 4 }).container;
        const img = await screen.findByRole("img", { name: "T" });
        fireEvent.click(await awaitReady());
        const key = await screen.findByLabelText("C5");
        // A two-bar, four-per-bar phrase clears in eight presses of its single degree.
        for (let i = 0; i < 8; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        await screen.findAllByText("Accuracy", undefined, { timeout: 30000 });
        // The retargeted compatibility click: a bare click on the score, no pointer press.
        const svg = img.querySelector("svg")!;
        const rect = svg.getBoundingClientRect();
        fireEvent.click(img, {
            clientX: rect.left + rect.width * 0.3,
            clientY: rect.top + rect.height * 0.5,
        });
        expect(screen.queryByLabelText("Loop from bar")).toBeNull();
        expect(score.querySelectorAll("rect.plinky-bar-selection").length).toBe(0);
    });

    it("colours notes on the score as they are played", async () => {
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        const { container } = mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await awaitReady());
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        await waitFor(
            () => expect(container.querySelector(`[fill="${PLAYED_COLOR}"]`)).toBeTruthy(),
            { timeout: 30000 },
        );
    });

    it("leaves full screen and keeps the score on screen when the run finishes", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await awaitReady());
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        // Finishing the run drops back to the resting view: Practice is offered again and the
        // score is still mounted (a jump back to the library would unmount both).
        expect(
            await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 }),
        ).toBeTruthy();
        expect(screen.getByRole("img", { name: "T" })).toBeTruthy();
    });
});
