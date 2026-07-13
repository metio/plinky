// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { Prefs } from "../../core/prefs";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { createPrefsStore } from "../stores/prefsStore";
import { useSynth } from "./useSynth";

// The hook decides WHAT to sound; the injected fake records it. Prefs live in a
// memoryStore, the engine is a recorder — nothing global is stubbed.
function harness(prefsPatch: Partial<Prefs> = {}) {
    const audio = fakeAudioEngine();
    const prefs = createPrefsStore(memoryStore());
    prefs.save({ ...prefs.load(), ...prefsPatch });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ prefs, audio }}>{children}</ServicesProvider>
    );
    const { result } = renderHook(() => useSynth(), { wrapper });
    return { audio, synth: result.current, playNote: result.current.playNote };
}

describe("useSynth", () => {
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
            { kind: "release", note: 60 },
        ]);
        expect(audio.resumed).toBe(1);
    });

    it("opens no voice when muted, but still ends and pedals", () => {
        // A muted press must not reach the engine's ramps; release and pedal always do —
        // they are no-ops on a voice that never opened, and the pedal state must track.
        const { audio, synth } = harness({ sound: false });
        synth.pressNote(60);
        expect(audio.voices.filter((v) => v.kind === "press")).toHaveLength(0);
        synth.releaseNote(60);
        synth.setPedal("sustain", true);
        expect(audio.voices).toContainEqual({ kind: "release", note: 60 });
        expect(audio.pedals).toEqual([{ pedal: "sustain", down: true }]);
    });
});
