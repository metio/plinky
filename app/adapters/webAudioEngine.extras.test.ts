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
    it("is not scheduled with a fixed-length note", async () => {
        // A knock is the damper landing, and on a real instrument that is a sparse sound —
        // it needs a key to come up with nothing else holding it. A scheduled note has no
        // such test: every one ends at a known time, so knocking with each put a broadband
        // click on every note and a click train through anything fast, measurably over the
        // music. Listen and every video export strike this way.
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.strike({ note: 72, gain: 0.3, velocity: 90, duration: 0.5, delay: 0 });
        expect(samples.extras().filter((one) => one.kind === "knock")).toHaveLength(0);
    });

    it("is not scheduled with a fixed-length note", async () => {
        // A knock is the damper landing, and on a real instrument that is a sparse sound —
        // it needs a key to come up with nothing else holding it. A scheduled note has no
        // such test: every one ends at a known time, so knocking with each put a broadband
        // click on every note and a click train through anything fast, measurably over the
        // music. Listen and every video export strike this way.
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        engine.strike({ note: 72, gain: 0.3, velocity: 90, duration: 0.5, delay: 0 });
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

describe("everything a rendered piece asks the instrument for", () => {
    it("is one recording per note, plus the pedal's own resonance", async () => {
        // The guard, and the reason it is a LIST rather than a measurement.
        //
        // A key-off knock was once scheduled with every note on this path — including under
        // the pedal, where a real piano cannot make that sound at all. In a fast passage
        // that is a click per note, several at once under a chord, and every exported video
        // carried it while the app sounded right.
        //
        // Nothing caught it. The unit tests around it asked which recordings were requested
        // and were content to assert the wrong answer. Measuring the finished audio does
        // not work either: a click carries almost no energy beside a sustained note, so
        // loudness, attack counts and high-frequency share were all tried and none of them
        // can tell a clean render from a knocking one. The fault was musical, not numerical.
        //
        // What a machine CAN hold onto is the tally. Pin every sound a performance asks for
        // and any new one — a knock, a resonance, anything scheduled per note by a future
        // change — moves these numbers and has to be argued for in review rather than
        // discovered by listening to a finished clip.
        const fake = fakeAudioContext();
        const samples = pack();
        const engine = await engineWith(fake, samples.lookup);
        // A short passage with the shapes that matter: a plain note, a short one, a chord,
        // and one held under the pedal.
        engine.strike({ note: 60, gain: 0.3, velocity: 90, duration: 0.5, delay: 0 });
        engine.strike({ note: 62, gain: 0.3, velocity: 90, duration: 0.08, delay: 0.5 });
        for (const note of [64, 67, 71]) {
            engine.strike({ note, gain: 0.3, velocity: 90, duration: 0.4, delay: 1 });
        }
        engine.strike({
            note: 72,
            gain: 0.3,
            velocity: 90,
            duration: 0.6,
            delay: 1.5,
            pedalled: true,
        });

        const tally = samples.asked.reduce<Record<string, number>>((count, one) => {
            count[one.kind] = (count[one.kind] ?? 0) + 1;
            return count;
        }, {});
        // Six notes, six recordings. The one extra is the sympathetic resonance under the
        // pedalled note — the rest of the instrument answering a note struck with the
        // dampers off — and it is deliberate, which is why it is written here rather than
        // waved through by a looser assertion. No knocks: nothing on this path ends with a
        // damper landing, because nothing on this path is a key coming up.
        expect(tally).toEqual({ note: 6, resonance: 1 });
    });
});

describe("a click", () => {
    it("can be taken back off the clock before it sounds", async () => {
        // A count-in queued whole on the audio clock has to come off whole when the
        // player restarts or leaves: allNotesOff reaches the voices, and a click is a
        // fire-and-forget oscillator it never sees.
        const fake = fakeAudioContext();
        const engine = await engineWith(fake, silentPack);
        const cancel = engine.click(5, "beat", 0.2);
        // Queued for five seconds out, so it is still ringing at four.
        expect(fake.ringingAt(4)).toBe(1);
        cancel();
        expect(fake.ringingAt(4)).toBe(0);
    });

    it("hands back a cancel that does nothing for a click never queued", async () => {
        const fake = fakeAudioContext();
        const engine = await engineWith(fake, silentPack);
        expect(() => engine.click(1, "beat", 0)()).not.toThrow();
        expect(fake.started()).toBe(0);
    });
});
