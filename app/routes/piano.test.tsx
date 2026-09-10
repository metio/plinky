// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { fakeMidi } from "../adapters/fakeMidi";
import { memoryStore } from "../adapters/memoryStore";
import { MidiProvider } from "../contexts/midi";
import { createServices, ServicesProvider } from "../contexts/services";
import { createActivitySignal } from "../lib/activity";
import { m } from "../paraglide/messages.js";
import Piano from "./piano";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// The page's whole job is that the computer keyboard plays, so the provider is real and
// only the device seam is faked — a fake provider would make every assertion here vacuous.
function mount() {
    const audio = fakeAudioEngine();
    const services = createServices({
        audio,
        midi: fakeMidi(),
        store: memoryStore(),
        activity: createActivitySignal(),
    });
    const view = render(
        <ServicesProvider services={services}>
            <MidiProvider>
                <MemoryRouter>
                    <Piano />
                </MemoryRouter>
            </MidiProvider>
        </ServicesProvider>,
    );
    return { ...view, audio };
}

const press = (key: string, code: string, shiftKey = false) =>
    act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, code, shiftKey }));
    });

const release = (key: string, code: string) =>
    act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key, code }));
    });

describe("piano route", () => {
    it("opens on the instrument, with nothing to do first", () => {
        mount();
        expect(screen.getByRole("heading", { name: m.piano_title() })).toBeTruthy();
        // The keys are there on arrival. A page whose point is "just play" must not put a
        // start button, a mode, or a chosen piece between the visitor and a sound.
        expect(screen.getAllByRole("button", { name: /^C ?4$/ }).length).toBeGreaterThan(0);
    });

    it("declares itself a surface the computer keyboard plays", () => {
        mount();
        // Elsewhere the letter keys belong to the page and a keydown does nothing. Here
        // pressing one has to sound a note — that opt-in is the difference between an
        // instrument and a picture of one.
        press("z", "KeyZ");
        expect(screen.getByRole("button", { name: /^C ?4$/ }).getAttribute("aria-pressed")).toBe(
            "true",
        );
        release("z", "KeyZ");
    });

    it("sounds what is played, for as long as it is held", () => {
        const { audio } = mount();
        // A lit key and no sound is a picture of a piano. The press opens a live voice and
        // the key-up ends it, stretched a little the way every imprecise input is.
        press("z", "KeyZ");
        expect(audio.voices).toContainEqual({ kind: "press", note: 60, gain: expect.any(Number) });
        release("z", "KeyZ");
        expect(audio.voices.at(-1)).toMatchObject({ kind: "release", note: 60 });
        expect((audio.voices.at(-1) as { holdScale: number }).holdScale).toBeGreaterThan(1);
    });

    it("sounds a note from a MIDI piano too", () => {
        const { audio } = mount();
        act(() => {
            window.__plinky?.play(67);
        });
        expect(audio.voices).toContainEqual({ kind: "press", note: 67, gain: expect.any(Number) });
        act(() => {
            window.__plinky?.release(67);
        });
        expect(audio.voices.at(-1)).toEqual({ kind: "release", note: 67, holdScale: 1 });
    });

    it("hands all three pedals to the sound", () => {
        const { audio } = mount();
        for (const pedal of ["sustain", "sostenuto", "soft"] as const) {
            act(() => {
                window.__plinky?.pedal(pedal, true);
            });
            expect(audio.pedals.at(-1)).toEqual({ pedal, down: true });
            act(() => {
                window.__plinky?.pedal(pedal, false);
            });
            expect(audio.pedals.at(-1)).toEqual({ pedal, down: false });
        }
    });

    it("follows the playing up the keyboard rather than stopping at the window's edge", () => {
        mount();
        // The window opens around middle C and holds two octaves. A note well above it can
        // only sound if the keybed slid to meet it, which is what free play needs: there is
        // no piece here to frame the window, so it has to follow the player.
        expect(screen.queryByRole("button", { name: /^C ?7$/ })).toBeNull();
        act(() => {
            window.__plinky?.play(96); // C7
        });
        expect(screen.getByRole("button", { name: /^C ?7$/ })).toBeTruthy();
    });

    it("offers a way on to the music without asking for it first", () => {
        mount();
        const onward = screen.getByRole("link", { name: m.today_browse() });
        expect(onward.getAttribute("href")).toBe("/en/music/");
    });
});
