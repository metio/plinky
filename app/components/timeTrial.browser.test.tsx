// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MidiProvider } from "../contexts/midi";
import type { Exercise } from "../lib/exercises";
import { TimeTrial } from "./timeTrial";

const exercise: Exercise = {
    id: "time-trial-browser",
    title: "Time trial browser",
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

describe("TimeTrial", () => {
    it("starts the count-in and ignores input until armed", async () => {
        // The metronome's audio-clock count-in does not advance in a muted headless
        // browser, so this covers the start path: counting begins, and a note played
        // during the count-in is ignored (the run is not yet armed).
        const container = document.createElement("div");
        document.body.appendChild(container);
        mounted.push(container);
        render(
            <MidiProvider>
                <TimeTrial exercise={exercise} />
            </MidiProvider>,
            { container },
        );

        const start = await screen.findByRole("button", { name: "Start time trial" });
        await waitFor(() => expect(start).not.toBeDisabled());
        fireEvent.click(start);

        expect(await screen.findByText(/Count-in/)).toBeDefined();
        await act(async () => {
            window.__plinky?.play(60);
        });
        expect(screen.getByText(/Progress/).parentElement?.textContent).toContain("0/4");
    });
});
