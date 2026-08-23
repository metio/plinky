// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtraKind } from "../../core/sampledPiano";
import { fakeAudioContext } from "../testing/fakeAudioContext";
import type { SampleVoice } from "../ports/sampleSource";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

// A pack that answers everything, recording what was asked of it. What the engine plays is
// invisible from the outside — a knock is one more buffer source among several — so the
// question a test can actually ask is which recordings it went looking for, and when.
function pack() {
    const asked: { kind: ExtraKind | "note"; pitch: number }[] = [];
    const voice = { buffer: { duration: 0.4 } as AudioBuffer, rate: 1 } as SampleVoice;
    return {
        asked,
        extras: () => asked.filter((one) => one.kind !== "note"),
        lookup: {
            voiceFor(pitch: number) {
                asked.push({ kind: "note", pitch });
                return voice;
            },
            extraFor(pitch: number, _velocity: number, kind: ExtraKind) {
                asked.push({ kind, pitch });
                return voice;
            },
        },
    };
}

// A pack that has nothing decoded — the ordinary state before recordings arrive, and the
// permanent state for a player who never turns the real piano on.
const silentPack = { voiceFor: () => null, extraFor: () => null };

const engineWith = async (
    fake: ReturnType<typeof fakeAudioContext>,
    source: { voiceFor: unknown; extraFor: unknown },
) => {
    const FakeContext = function FakeContext() {
        return fake.context as unknown as AudioContext;
    } as unknown as typeof AudioContext;
    vi.stubGlobal("AudioContext", FakeContext);
    vi.resetModules();
    const engine = await import("./webAudioEngine");
    engine.playFromSamples(() => ({ source: source as never }));
    engine.webAudioEngine.resume();
    return engine.webAudioEngine;
};

describe("the key-off knock", () => {
    it("is scheduled with a fixed-length note, at its damper", async () => {
        // Listen and a replay strike fixed-length notes rather than pressing and releasing,
        // and the damper lands at a time known when the note is scheduled. Without this a
        // recorded piano knocked under the player's hands and not under the computer's,
        // which is two instruments.
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.strike({ note: 72, gain: 0.3, velocity: 90, duration: 0.5, delay: 0 });
        expect(samples.extras()).toEqual([{ kind: "knock", pitch: 72 }]);
    });

    it("is not scheduled with a note struck under the pedal", async () => {
        // The same rule as the pressed-and-released case below, on the path Listen and
        // every video export actually use. It held for a player's hands and not for a
        // scheduled note, so an exported piece knocked once per note — several at once
        // under a chord — through every pedalled bar.
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.strike({
            note: 72,
            gain: 0.3,
            velocity: 90,
            duration: 0.5,
            delay: 0,
            pedalled: true,
        });
        expect(samples.extras().filter((one) => one.kind === "knock")).toHaveLength(0);
    });

    it("sounds when the damper lands", async () => {
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.press(60, 0.3, 90);
        expect(samples.extras()).toHaveLength(0);
        engine.release(60);
        expect(samples.extras()).toEqual([{ kind: "knock", pitch: 60 }]);
    });

    it("does not sound while the sustain pedal is still holding the note", async () => {
        // A knock is the damper touching the string. Under the pedal the damper is off the
        // string, so the key coming up makes no such sound — a piano that knocked here
        // would be knocking at the one moment a real one is silent.
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.press(60, 0.3, 90);
        engine.setPedal("sustain", true);
        engine.release(60);
        expect(samples.extras().filter((one) => one.kind === "knock")).toHaveLength(0);
        // …and it arrives when the pedal finally lifts and the damper does land.
        engine.setPedal("sustain", false);
        expect(samples.extras().filter((one) => one.kind === "knock")).toHaveLength(1);
    });

    it("is not invented for the synthesised piano", async () => {
        // The knock is a recording. With no pack there is nothing to play, and a
        // synthesised approximation would be a click, not a piano.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake, silentPack);
        engine.press(60, 0.3, 90);
        engine.release(60);
        // Nothing from the pack sounded at all: the voice was synthesised, and no
        // recording — note or knock — was played.
        expect(fake.recordingsPlayed()).toBe(0);
    });
});

describe("a panic", () => {
    it("silences without knocking once per voice", async () => {
        // allNotesOff is a play surface tearing down or a run ending — not fifty dampers
        // landing. It rings the voices out directly rather than through endVoice, and this
        // is what says so: routing it through endVoice would fire a knock per held note,
        // which is a sound no piano makes and one nothing else would catch.
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        for (const note of [60, 64, 67]) {
            engine.press(note, 0.3, 90);
        }
        samples.asked.length = 0;
        engine.allNotesOff();
        expect(samples.extras()).toHaveLength(0);
    });
});

describe("sympathetic resonance", () => {
    it("answers a note struck with the pedal down", async () => {
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.setPedal("sustain", true);
        engine.press(64, 0.3, 90);
        expect(samples.extras()).toEqual([{ kind: "resonance", pitch: 64 }]);
    });

    it("stays quiet when the dampers are down", async () => {
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.press(64, 0.3, 90);
        expect(samples.extras().filter((one) => one.kind === "resonance")).toHaveLength(0);
    });

    it("answers a Listen strike that the score pedals", async () => {
        // Listen never presses the engine's pedal — it models pedalling by lengthening each
        // note, so the engine's own pedal state says "up" throughout a pedalled piece. The
        // flag on the strike is how the fact reaches it.
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.strike({ note: 67, gain: 0.3, velocity: 90, duration: 1, delay: 0, pedalled: true });
        expect(samples.extras()).toContainEqual({ kind: "resonance", pitch: 67 });
    });

    it("leaves an unpedalled Listen strike alone", async () => {
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.strike({ note: 67, gain: 0.3, velocity: 90, duration: 1, delay: 0 });
        expect(samples.extras().filter((one) => one.kind === "resonance")).toHaveLength(0);
    });
});
