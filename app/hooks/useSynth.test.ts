// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { savePrefs } from "../lib/prefs";
import { useSynth } from "./useSynth";

let oscillators = 0;

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
    detune = new FakeParam();
    type = "";
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
    createBiquadFilter() {
        return new FakeNode();
    }
    createOscillator() {
        oscillators++;
        return new FakeNode();
    }
}

beforeEach(() => {
    oscillators = 0;
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    localStorage.clear();
});
afterEach(() => localStorage.clear());

describe("useSynth", () => {
    it("builds a voice when sound is on", () => {
        savePrefs({
            sound: true,
            volume: 80,
            masteryThreshold: "A",
            handSpan: { left: null, right: null },
            showFingerings: true,
            noteHints: "miss",
            forgiving: false,
            fingerHints: true,
            decayMode: "gentle",
            reviewCap: 8,
            barsPerRow: 0,
        });
        const { result } = renderHook(() => useSynth());
        result.current.playNote(60);
        expect(oscillators).toBeGreaterThan(0);
    });

    it("stays silent when sound is off", () => {
        savePrefs({
            sound: false,
            volume: 80,
            masteryThreshold: "A",
            handSpan: { left: null, right: null },
            showFingerings: true,
            noteHints: "miss",
            forgiving: false,
            fingerHints: true,
            decayMode: "gentle",
            reviewCap: 8,
            barsPerRow: 0,
        });
        const { result } = renderHook(() => useSynth());
        result.current.playNote(60);
        expect(oscillators).toBe(0);
    });

    it("stays silent — and does not throw — at volume 0", () => {
        // An exponential gain ramp to 0 is a RangeError, so volume 0 must short-circuit.
        savePrefs({
            sound: true,
            volume: 0,
            masteryThreshold: "A",
            handSpan: { left: null, right: null },
            showFingerings: true,
            noteHints: "miss",
            forgiving: false,
            fingerHints: true,
            decayMode: "gentle",
            reviewCap: 8,
            barsPerRow: 0,
        });
        const { result } = renderHook(() => useSynth());
        expect(() => result.current.playNote(60)).not.toThrow();
        expect(oscillators).toBe(0);
    });
});
