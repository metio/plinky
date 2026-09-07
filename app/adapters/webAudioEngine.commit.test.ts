// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { SampleVoice } from "../ports/sampleSource";
import { fakeAudioContext } from "../testing/fakeAudioContext";

// A pack that answers every note, and counts how often it was asked.
function pack() {
    let asked = 0;
    const voice = { buffer: { duration: 0.4 } as AudioBuffer, rate: 1 } as SampleVoice;
    return {
        asked: () => asked,
        lookup: {
            voiceFor() {
                asked += 1;
                return voice;
            },
            extraFor() {
                return null;
            },
        },
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

async function engineWith(state: { source: unknown; settled: boolean }) {
    const fake = fakeAudioContext();
    const FakeContext = function FakeContext() {
        return fake.context as unknown as AudioContext;
    } as unknown as typeof AudioContext;
    vi.stubGlobal("AudioContext", FakeContext);
    vi.resetModules();
    const engine = await import("./webAudioEngine");
    engine.playFromSamples(() => ({ source: state.source as never, settled: state.settled }));
    engine.webAudioEngine.resume();
    return engine.webAudioEngine;
}

const strike = (engine: { strike: (s: never) => void }) =>
    engine.strike({ note: 60, gain: 0.3, velocity: 90, duration: 0.5, delay: 0 } as never);

describe("the instrument a run commits to", () => {
    it("takes a recording note by note before any run has committed", async () => {
        const samples = pack();
        const state = { source: samples.lookup, settled: false };
        const engine = await engineWith(state);
        strike(engine);
        expect(samples.asked()).toBe(1);
    });

    it("keeps to the synthesised voice for a run that started while recordings were arriving", async () => {
        // The recordings land mid-run; the run does not switch under the player's hands.
        const samples = pack();
        const state = { source: samples.lookup, settled: false };
        const engine = await engineWith(state);
        engine.commitVoice();
        state.settled = true;
        strike(engine);
        strike(engine);
        expect(samples.asked()).toBe(0);
    });

    it("plays the recordings for a run that started once they had all arrived", async () => {
        const samples = pack();
        const state = { source: samples.lookup, settled: true };
        const engine = await engineWith(state);
        engine.commitVoice();
        strike(engine);
        expect(samples.asked()).toBe(1);
    });

    it("decides again at the next run", async () => {
        const samples = pack();
        const state = { source: samples.lookup, settled: false };
        const engine = await engineWith(state);
        engine.commitVoice();
        strike(engine);
        expect(samples.asked()).toBe(0);
        state.settled = true;
        engine.commitVoice();
        strike(engine);
        expect(samples.asked()).toBe(1);
    });
});
