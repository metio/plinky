// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prefs } from "../../core/prefs";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { createPrefsStore } from "../stores/prefsStore";
import { useMetronome } from "./useMetronome";

// The injected fake supplies the audio clock and records the queued clicks, so
// the lookahead scheduling is observable without any Web Audio.
function harness(
    enabled: boolean,
    bpm: number,
    beatsPerBar: number,
    subdivision = 1,
    prefsPatch: Partial<Prefs> = {},
) {
    const audio = fakeAudioEngine();
    const prefs = createPrefsStore(memoryStore());
    prefs.save({ ...prefs.load(), ...prefsPatch });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ prefs, audio }}>{children}</ServicesProvider>
    );
    const hook = renderHook(() => useMetronome(enabled, bpm, beatsPerBar, subdivision), {
        wrapper,
    });
    return { audio, unmount: hook.unmount };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useMetronome", () => {
    it("queues an accented downbeat and plain beats on the audio clock", () => {
        // 120 bpm in 4/4: beats land 0.5 s apart starting at now + 0.1.
        const { audio } = harness(true, 120, 4);
        expect(audio.clicks.length).toBeGreaterThan(0);
        expect(audio.clicks[0]?.kind).toBe("accent");
        expect(audio.clicks[0]?.time).toBeCloseTo(0.1);
        expect(audio.resumed).toBe(1);
    });

    it("queues more ticks as the clock advances", () => {
        const { audio } = harness(true, 120, 4);
        const initial = audio.clicks.length;
        audio.time = 1;
        vi.advanceTimersByTime(50);
        expect(audio.clicks.length).toBeGreaterThan(initial);
    });

    it("marks subdivision ticks between beats", () => {
        const { audio } = harness(true, 120, 4, 2);
        // Let the lookahead window sweep over a full beat so an off-beat
        // subdivision tick is queued alongside the beats.
        audio.time = 1;
        vi.advanceTimersByTime(50);
        const kinds = audio.clicks.map((click) => click.kind);
        expect(kinds).toContain("sub");
        expect(kinds).toContain("beat");
    });

    it("queues silent ticks while muted, so the pulse survives a mute toggle", () => {
        const { audio } = harness(true, 120, 4, 1, { sound: false });
        expect(audio.clicks.length).toBeGreaterThan(0);
        expect(audio.clicks.every((click) => click.gain === 0)).toBe(true);
    });

    it("does nothing while disabled", () => {
        const { audio } = harness(false, 120, 4);
        vi.advanceTimersByTime(200);
        expect(audio.clicks).toHaveLength(0);
    });

    it("stops queueing after unmount", () => {
        const { audio, unmount } = harness(true, 120, 4);
        unmount();
        const after = audio.clicks.length;
        audio.time = 2;
        vi.advanceTimersByTime(200);
        expect(audio.clicks.length).toBe(after);
    });
});
