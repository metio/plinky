// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { generatePhrase } from "../../../core/generator";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { testPrefsStore } from "../../testing/stores";
import { ScoreViewer } from "./scoreViewer";

// The notes-highway reading mode covers the staff with a tall highway while playing.
// OSMD must stay mounted and drive the run underneath, so this verifies both: the
// highway appears, and a run still completes through the covered staff. OSMD renders
// only in a real browser.

const mount = (xml: string) =>
    render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi() }}>
                <MidiProvider>
                    <ScoreViewer id="hw" xml={xml} title="Highway" />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("notes-highway reading mode", () => {
    it("covers the staff while playing, and the run still completes through it", async () => {
        // Turn the reading mode on (the app's prefs store reads the same localStorage).
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        // A one-bar phrase whose every note is C5, so one key clears each position.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase);
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        fireEvent.click(practice);

        // The highway is up once the run starts.
        expect(await screen.findByLabelText(m.highway_label())).toBeTruthy();

        // Play the four notes on the on-screen key — the matcher walks the OSMD cursor
        // hidden behind the highway, so this proves the staff still drives the run.
        const key = await screen.findByLabelText("C 5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        expect(await screen.findByText("Run saved", undefined, { timeout: 30000 })).toBeTruthy();
    });
});
