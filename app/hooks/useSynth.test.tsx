// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { KEYBOARD_DEVICE, ON_SCREEN_DEVICE } from "../../core/midi";
import type { Prefs } from "../../core/prefs";
import { ROOM_WET } from "../../core/room";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { createPrefsStore } from "../stores/prefsStore";
import { useSynth } from "./useSynth";

// The hook decides WHAT to sound; the injected fake records it. Prefs live in a
// memoryStore, the engine is a recorder — nothing global is stubbed.
function harness(prefsPatch: Partial<Prefs> = {}, asleep = false) {
    const audio = fakeAudioEngine();
    audio.asleep = asleep;
    const prefs = createPrefsStore(memoryStore());
    prefs.save({ ...prefs.load(), ...prefsPatch });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ prefs, audio }}>{children}</ServicesProvider>
    );
    const { result } = renderHook(() => useSynth(), { wrapper });
    return { audio, synth: result.current, playNote: result.current.playNote };
}

describe("useSynth", () => {
    it("sets the room from the player's own setting before it strikes", () => {
        // The room is a property of the graph, not of a note, so it cannot ride in on the
        // gain the way the volume preference does. Applied on the way to every strike rather
        // than watched from an effect — the room is only audible when something sounds, so
        // the moment before a note is exactly when it has to be right.
        const { audio, synth } = harness({ reverb: 50 });
        synth.playNote(60);
        expect(audio.room).toBeCloseTo(ROOM_WET / 2);
    });

    it("goes dry when the player asks for no room", () => {
        const { audio, synth } = harness({ reverb: 0 });
        synth.playNote(60);
        expect(audio.room).toBe(0);
    });

    it("strikes the engine when sound is on", () => {
        const { audio, playNote } = harness();
        playNote(60);
        expect(audio.strikes).toHaveLength(1);
        expect(audio.strikes[0]?.note).toBe(60);
        expect(audio.resumed).toBe(1);
    });

    it("scales the strike gain with velocity and the volume preference", () => {
        const { audio, playNote } = harness({ volume: 50 });
        playNote(60, { velocity: 127 });
        playNote(60, { velocity: 64 });
        const [loud, soft] = audio.strikes;
        expect(loud?.gain).toBeCloseTo(0.32 * 0.5);
        expect(soft?.gain ?? 0).toBeLessThan(loud?.gain ?? 0);
    });

    it("stays silent when sound is off", () => {
        const { audio, playNote } = harness({ sound: false });
        playNote(60);
        expect(audio.strikes).toHaveLength(0);
    });

    it("panics all voices through the engine, even muted", () => {
        // silenceAll clears voice and pedal state, which must happen regardless of the
        // volume preference — a muted session opened no voice, but the panic still runs.
        const { audio, synth } = harness({ sound: false });
        synth.silenceAll();
        expect(audio.silenced).toBe(1);
    });

    it("stays silent at volume 0", () => {
        // An exponential gain ramp to 0 is a RangeError in the engine, so a
        // zero-gain strike must never reach it.
        const { audio, playNote } = harness({ volume: 0 });
        playNote(60);
        expect(audio.strikes).toHaveLength(0);
    });

    it("passes the chord-scheduling delay through, clamped to now", () => {
        const { audio, playNote } = harness();
        playNote(60, { delay: 0.25 });
        playNote(60, { delay: -1 });
        expect(audio.strikes[0]?.delay).toBe(0.25);
        expect(audio.strikes[1]?.delay).toBe(0);
    });

    it("presses and releases a live voice, scaling the press gain with velocity", () => {
        const { audio, synth } = harness({ volume: 50 });
        synth.pressNote(60, { velocity: 127 });
        synth.releaseNote(60);
        expect(audio.voices).toEqual([
            { kind: "press", note: 60, gain: 0.32 * 0.5 },
            { kind: "release", note: 60, holdScale: 1 },
        ]);
        expect(audio.resumed).toBe(1);
    });

    it("passes an imprecise input's generous hold scale through to the engine", () => {
        const { audio, synth } = harness();
        synth.pressNote(60);
        synth.releaseNote(60, 1.8);
        expect(audio.voices).toContainEqual({ kind: "release", note: 60, holdScale: 1.8 });
    });

    it("opens no voice when muted, but still ends and pedals", () => {
        // A muted press must not reach the engine's ramps; release and pedal always do —
        // they are no-ops on a voice that never opened, and the pedal state must track.
        const { audio, synth } = harness({ sound: false });
        synth.pressNote(60);
        expect(audio.voices.filter((v) => v.kind === "press")).toHaveLength(0);
        synth.releaseNote(60);
        synth.setPedal("sustain", true);
        expect(audio.voices).toContainEqual({ kind: "release", note: 60, holdScale: 1 });
        expect(audio.pedals).toEqual([{ pedal: "sustain", down: true }]);
    });
});

describe("decoration when audio is asleep", () => {
    it("drops a decorative note rather than scheduling it", () => {
        // A strike is timed against the audio context's own clock, and that clock is
        // frozen while the context is suspended — so five hovers down a list would all
        // land on one instant and arrive as a single chord whenever audio finally woke.
        const { audio, playNote } = harness({}, true);
        playNote(60, { decorative: true });
        playNote(64, { decorative: true });
        expect(audio.strikes).toEqual([]);
        // And it does not try to wake audio either: a hover is not a user gesture, so
        // the browser would refuse, and decoration has no business asking.
        expect(audio.resumed).toBe(0);
    });

    it("still plays a note the player asked for — late beats never", () => {
        const { audio, playNote } = harness({}, true);
        playNote(60);
        expect(audio.strikes).toHaveLength(1);
        expect(audio.resumed).toBe(1);
    });

    it("plays decoration normally once audio is awake", () => {
        const { audio, playNote } = harness();
        playNote(60, { decorative: true });
        expect(audio.strikes).toHaveLength(1);
    });
});

describe("when the player's own instrument makes the sound", () => {
    // Reported from a real piano over USB MIDI: every note was being played twice, once by
    // the piano and once by Plinky a few milliseconds behind. It is also why a stuck note
    // was audible at all — the voice that hung was Plinky's copy, not the piano's string.
    const MIDI = "Yamaha P-125";

    it("leaves a note from the instrument to the instrument", () => {
        const { audio, synth } = harness({ instrumentSounds: true });

        synth.pressNote(60, { velocity: 100, device: MIDI });

        expect(audio.voices).toEqual([]);
    });

    it("still answers the on-screen and computer keyboards, which have no voice", () => {
        // The setting is about the instrument in the room. A drawn key and a typed key
        // make no sound of their own, so silencing them would leave the player with
        // nothing at all.
        const { audio, synth } = harness({ instrumentSounds: true });

        synth.pressNote(60, { velocity: 100, device: ON_SCREEN_DEVICE });
        synth.pressNote(62, { velocity: 100, device: KEYBOARD_DEVICE });
        synth.pressNote(64, { velocity: 100 });

        expect(audio.voices.map((one) => one.note)).toEqual([60, 62, 64]);
    });

    it("still plays everything Plinky plays by itself", () => {
        // Listen, the metronome, the duet's other hand and every demonstration go through
        // strike rather than press, and none of them is the player's own instrument.
        const { audio, synth } = harness({ instrumentSounds: true });

        synth.playNote(60);

        expect(audio.strikes).toHaveLength(1);
    });

    it("answers the instrument when the setting is off", () => {
        const { audio, synth } = harness({ instrumentSounds: false });

        synth.pressNote(60, { velocity: 100, device: MIDI });

        expect(audio.voices).toHaveLength(1);
    });

    it("still ends a voice and still tracks the pedal", () => {
        // Release and pedal must reach the engine regardless: a session that opened no
        // voice has nothing to end, but the pedal state has to stay true either way.
        const { audio, synth } = harness({ instrumentSounds: true });

        synth.pressNote(60, { velocity: 100, device: MIDI });
        synth.releaseNote(60);
        synth.setPedal("sustain", true);

        expect(audio.voices).toEqual([{ kind: "release", note: 60, holdScale: 1 }]);
        expect(audio.pedals).toContainEqual({ pedal: "sustain", down: true });
    });
});
