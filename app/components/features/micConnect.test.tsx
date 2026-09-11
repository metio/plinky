// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakePitch } from "../../adapters/fakePitch";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider, useMidiInput } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { fakeAudioContext } from "../../testing/fakeAudioContext";
import { renderWithServices } from "../../testing/renderWithServices";
import { MicConnect } from "./micConnect";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

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

    it("swallows the speaker's own echo — on and off — but hears the player", async () => {
        const pitch = fakePitch();
        const heard: Array<{ note: number; device: string }> = [];
        // An engine that says "I just synthesized C4": the mic hearing C4 (or
        // its octave neighbour) is our speaker, anything else is the player.
        const audio = {
            now: () => 0,
            running: () => true,
            resume: () => {},
            unlock: () => {},
            strike: () => {},
            press: () => {},
            release: () => {},
            setPedal: () => {},
            allNotesOff: () => {},
            silenceStrikes: () => {},
            click: () => () => {},
            setRoom: () => {},
            commitVoice: () => {},
            uncommitVoice: () => {},
            recentlyStruck: (note: number) => note === 60,
        };
        renderWithServices(
            <MidiProvider>
                <MicConnect />
                <FunnelProbe heard={heard} />
            </MidiProvider>,
            { pitch, audio },
        );
        fireEvent.click(screen.getByRole("button", { name: m.mic_listen() }));
        await waitFor(() => expect(pitch.listening()).toBe(true));

        act(() => pitch.emit({ kind: "on", note: 60 }));
        act(() => pitch.emit({ kind: "on", note: 64 }));
        act(() => pitch.emit({ kind: "off", note: 60 }));
        expect(heard).toEqual([{ note: 64, device: "Microphone" }]);
    });

    it("hears the player on a pitch a stopped playback had struck, once its sound is gone", async () => {
        // The real engine behind the guard: Listen strikes C4 for four seconds and is
        // stopped at once. While it rang the mic hearing C4 was our speaker; once the fade
        // is over, C4 is the player starting the piece.
        let wall = 1_000;
        vi.spyOn(performance, "now").mockImplementation(() => wall);
        const fake = fakeAudioContext();
        vi.stubGlobal("AudioContext", function FakeContext() {
            return fake.context;
        });
        vi.resetModules();
        const { webAudioEngine: audio } = await import("../../adapters/webAudioEngine");
        const pitch = fakePitch();
        const heard: Array<{ note: number; device: string }> = [];
        renderWithServices(
            <MidiProvider>
                <MicConnect />
                <FunnelProbe heard={heard} />
            </MidiProvider>,
            { pitch, audio },
        );
        fireEvent.click(screen.getByRole("button", { name: m.mic_listen() }));
        await waitFor(() => expect(pitch.listening()).toBe(true));

        const listen = Symbol("listen");
        audio.resume();
        audio.strike({ note: 60, gain: 0.3, velocity: 90, duration: 4, delay: 0, owner: listen });
        act(() => pitch.emit({ kind: "on", note: 60 }));
        act(() => pitch.emit({ kind: "off", note: 60 }));
        expect(heard).toEqual([]);

        audio.silenceStrikes(listen);
        wall += 500;
        act(() => pitch.emit({ kind: "on", note: 60 }));
        expect(heard).toEqual([{ note: 60, device: "Microphone" }]);
    });

    it("hands the saved calibration to the live detector when listening starts", async () => {
        const pitch = fakePitch();
        const calibration = { noiseFloor: 0.02, softLevel: 0.03, loudLevel: 0.2, octaveShift: -1 };
        // A device that already ran the wizard: its tuning is in the prefs store.
        const store = memoryStore({
            "plinky:prefs": JSON.stringify({ micCalibration: calibration }),
        });
        renderWithServices(
            <MidiProvider>
                <MicConnect />
            </MidiProvider>,
            { pitch, store },
        );

        fireEvent.click(screen.getByRole("button", { name: m.mic_listen() }));
        await waitFor(() => expect(pitch.listening()).toBe(true));
        expect(pitch.lastCalibration()).toEqual(calibration);
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
