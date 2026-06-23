// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetronome } from "./useMetronome";

class FakeParam {
    value = 0;
    setValueAtTime() {
        return this;
    }
    exponentialRampToValueAtTime() {
        return this;
    }
}
class FakeNode {
    gain = new FakeParam();
    frequency = new FakeParam();
    connect() {
        return this;
    }
    start() {}
    stop() {}
}
// The most recently created context, so a test can drive its audio clock.
let context: FakeAudioContext;
class FakeAudioContext {
    currentTime = 0;
    destination = {};
    constructor() {
        context = this;
    }
    resume() {
        return Promise.resolve();
    }
    createGain() {
        return new FakeNode();
    }
    createOscillator() {
        return new FakeNode();
    }
}

beforeEach(() => {
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
});
afterEach(() => {
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext = undefined;
});

describe("useMetronome", () => {
    it("starts ticking and stops", () => {
        const { result } = renderHook(() => useMetronome());
        expect(result.current.running).toBe(false);
        act(() => result.current.startMetronome(120, 4));
        expect(result.current.running).toBe(true);
        act(() => result.current.setTempo(140));
        act(() => result.current.stop());
        expect(result.current.running).toBe(false);
    });

    it("fires the completion callback after a count-in, then stops", () => {
        vi.useFakeTimers();
        try {
            const onComplete = vi.fn();
            const { result } = renderHook(() => useMetronome());

            // A one-beat count-in at a brisk tempo; the first scheduler pass (run
            // inside begin) schedules the single beat and leaves nothing remaining.
            act(() => result.current.countIn(600, 1, onComplete, 1));
            expect(result.current.running).toBe(true);

            // Advance the audio clock past the scheduled beat so the next scheduler
            // tick arms the completion timer, then let that timer fire.
            context.currentTime = 0.15;
            act(() => vi.advanceTimersByTime(30));
            act(() => vi.advanceTimersByTime(120));

            expect(onComplete).toHaveBeenCalledOnce();
            expect(result.current.running).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });
});
