// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakePitch } from "../../adapters/fakePitch";
import { MidiProvider, useMidiInput } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { MicConnect } from "./micConnect";

afterEach(cleanup);

// A probe on the shared note funnel: mic notes must reach the same subscribers
// a MIDI keyboard feeds, or practice would never hear the piano.
function FunnelProbe({ heard }: { heard: Array<{ note: number; device: string }> }) {
    useMidiInput({
        onNoteOn: (event) => heard.push({ note: event.note, device: event.device }),
    });
    return null;
}

const mount = (pitch = fakePitch(), heard: Array<{ note: number; device: string }> = []) =>
    renderWithServices(
        <MidiProvider>
            <MicConnect />
            <FunnelProbe heard={heard} />
        </MidiProvider>,
        { pitch },
    );

describe("MicConnect", () => {
    it("starts listening and shows the note it hears, live", async () => {
        const pitch = fakePitch();
        mount(pitch);

        fireEvent.click(screen.getByRole("button", { name: m.mic_listen() }));
        expect(await screen.findByText(m.mic_listening())).toBeTruthy();
        expect(screen.getByText(m.mic_play_something())).toBeTruthy();

        act(() => pitch.emit({ kind: "on", note: 60 }));
        expect(screen.getByText("C4")).toBeTruthy();
        // The button flips to the way back out.
        expect(screen.getByRole("button", { name: m.mic_stop() })).toBeTruthy();
    });

    it("feeds heard notes into the same funnel as MIDI, marked imprecise", async () => {
        const pitch = fakePitch();
        const heard: Array<{ note: number; device: string }> = [];
        mount(pitch, heard);

        fireEvent.click(screen.getByRole("button", { name: m.mic_listen() }));
        await waitFor(() => expect(pitch.listening()).toBe(true));

        act(() => pitch.emit({ kind: "on", note: 64 }));
        expect(heard).toEqual([{ note: 64, device: "Microphone" }]);
    });

    it("says so when the microphone is declined, without crashing the page", async () => {
        mount(fakePitch("denied"));

        fireEvent.click(screen.getByRole("button", { name: m.mic_listen() }));
        expect(await screen.findByText(m.mic_denied())).toBeTruthy();
    });

    it("releases the microphone when listening stops", async () => {
        const pitch = fakePitch();
        mount(pitch);

        fireEvent.click(screen.getByRole("button", { name: m.mic_listen() }));
        await waitFor(() => expect(pitch.listening()).toBe(true));
        fireEvent.click(screen.getByRole("button", { name: m.mic_stop() }));
        expect(pitch.listening()).toBe(false);
        expect(screen.getByRole("button", { name: m.mic_listen() })).toBeTruthy();
    });
});
