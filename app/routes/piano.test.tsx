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
    const services = createServices({
        audio: fakeAudioEngine(),
        midi: fakeMidi(),
        store: memoryStore(),
        activity: createActivitySignal(),
    });
    return render(
        <ServicesProvider services={services}>
            <MidiProvider>
                <MemoryRouter>
                    <Piano />
                </MemoryRouter>
            </MidiProvider>
        </ServicesProvider>,
    );
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
        expect(onward.getAttribute("href")).toBe("/music");
    });
});
