// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
class FakeAudioContext {
    currentTime = 0;
    destination = {};
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

    it("begins a count-in", () => {
        const { result } = renderHook(() => useMetronome());
        act(() => result.current.countIn(240, 4, () => {}, 4));
        expect(result.current.running).toBe(true);
        act(() => result.current.stop());
    });
});
