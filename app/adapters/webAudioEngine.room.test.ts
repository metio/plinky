// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAudioContext } from "../testing/fakeAudioContext";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

// The engine holds one shared context, so each test gets a fresh module with a fresh fake
// under it.
const engineWith = async (fake: ReturnType<typeof fakeAudioContext>) => {
    const FakeContext = function FakeContext() {
        return fake.context as unknown as AudioContext;
    } as unknown as typeof AudioContext;
    vi.stubGlobal("AudioContext", FakeContext);
    vi.resetModules();
    const { webAudioEngine } = await import("./webAudioEngine");
    return webAudioEngine;
};

describe("the room", () => {
    it("puts a struck note in it", async () => {
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();
        engine.strike({ note: 60, gain: 0.3, velocity: 90, duration: 1, delay: 0 });
        expect(fake.reachesConvolver("filter")).toBe(true);
    });

    it("puts a held note in it", async () => {
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();
        engine.press(60, 0.3, 90);
        expect(fake.reachesConvolver("filter")).toBe(true);
    });

    it("keeps the metronome out of it", async () => {
        // A click is timekeeping standing beside the music, not in it. Reverb smears the
        // very edge a player is listening for — and the click would still sound, so nothing
        // but this notices. It is the one routing mistake that cannot be heard as a bug,
        // only as a vaguely worse metronome.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();
        engine.click(0, "beat", 0.2);
        expect(fake.reachesConvolver("oscillator")).toBe(false);
    });

    it("gives the two ears their own response", async () => {
        // Both channels written, or the room is mono and has no width to it.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();
        engine.press(60, 0.3, 90);
        expect(fake.impulseChannels()).toEqual([0, 1]);
    });

    it("builds the room once, however many notes are played", async () => {
        // The convolver and its response are per context, not per voice: a response is a
        // second and a half of stereo audio, and building one per note would allocate
        // megabytes a bar and drop frames doing it.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake);
        engine.resume();
        for (let note = 60; note < 72; note++) {
            engine.strike({ note, gain: 0.3, velocity: 90, duration: 1, delay: 0 });
        }
        expect(fake.impulseChannels()).toEqual([0, 1]);
    });
});
