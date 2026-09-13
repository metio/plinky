// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi, fakeMidiInput } from "../../adapters/fakeMidi";
import { MidiProvider, useMidiConnection } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { HeroKeyboard } from "./heroKeyboard";
import { METHOD_NAME } from "./practiceMethods";

// Real chromium in the browser-midi project, a MIDI piano hot-plugged through the fake seam:
// raw note bytes go through the provider's own parse pipeline and input funnel, exactly as
// a real keyboard's do, and the front page's keys answer them.

function Status() {
    return <output aria-label="status">{useMidiConnection().status}</output>;
}

afterEach(cleanup);

describe("the front page's keyboard played from a MIDI piano", () => {
    it("opens the method on the key a note-on plays, and sounds the note", async () => {
        const input = fakeMidiInput({ name: "Stage Piano" });
        const midi = fakeMidi({ permission: "granted", inputs: [input] });
        const audio = fakeAudioEngine();
        render(
            <MemoryRouter>
                <ServicesProvider services={{ midi, audio }}>
                    <MidiProvider>
                        <Status />
                        <HeroKeyboard />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        await waitFor(() => expect(screen.getByLabelText("status").textContent).toBe("ready"));

        input.emit([0x90, 67, 100]); // note-on G4
        expect(
            await screen.findByRole("region", { name: METHOD_NAME.interleaving() }),
        ).toBeTruthy();
        expect(audio.voices).toContainEqual(expect.objectContaining({ kind: "press", note: 67 }));
        const key = screen.getByRole("button", {
            name: (name) => name.includes(METHOD_NAME.interleaving()),
        });
        expect(key.getAttribute("aria-pressed")).toBe("true");
        expect(key.getAttribute("aria-expanded")).toBe("true");

        input.emit([0x80, 67, 0]);
        await waitFor(() => expect(key.getAttribute("aria-pressed")).toBe("false"));

        // A black key and a note below the octave sound, and leave the open method alone.
        input.emit([0x90, 70, 90]);
        input.emit([0x90, 48, 90]);
        await waitFor(() =>
            expect(audio.voices).toContainEqual(
                expect.objectContaining({ kind: "press", note: 48 }),
            ),
        );
        expect(screen.getByRole("region", { name: METHOD_NAME.interleaving() })).toBeTruthy();
    });
});
