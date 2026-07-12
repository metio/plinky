// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    createNoteTracker,
    detectPitch,
    frequencyToMidi,
    midiToFrequency,
    STEP_SEMITONES,
} from "./pitch";

const SAMPLE_RATE = 44_100;

// A frame of the given frequency with a couple of soft overtones — closer to a
// piano's spectrum than a bare sine, which is exactly where naive detectors
// jump octaves.
function tone(freq: number, length = 2048, amplitude = 0.5): Float32Array {
    const frame = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const t = (i / SAMPLE_RATE) * 2 * Math.PI * freq;
        frame[i] = amplitude * (Math.sin(t) + 0.5 * Math.sin(2 * t) + 0.2 * Math.sin(3 * t));
    }
    return frame;
}

describe("midiToFrequency", () => {
    it("anchors A4 (MIDI 69) at 440 Hz", () => {
        expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    });

    it("doubles a frequency an octave up and halves it an octave down", () => {
        expect(midiToFrequency(81)).toBeCloseTo(880, 6);
        expect(midiToFrequency(57)).toBeCloseTo(220, 6);
    });

    it("puts middle C (MIDI 60) near 261.63 Hz", () => {
        expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
    });
});

describe("STEP_SEMITONES", () => {
    it("maps the seven natural letters to their offset above C", () => {
        expect(STEP_SEMITONES).toEqual({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
    });
});

describe("frequencyToMidi", () => {
    it("inverts midiToFrequency and snaps quarter-tone wobble to the meant note", () => {
        for (const note of [33, 48, 60, 69, 81, 96]) {
            expect(frequencyToMidi(midiToFrequency(note))).toBe(note);
            expect(frequencyToMidi(midiToFrequency(note) * 1.02)).toBe(note);
            expect(frequencyToMidi(midiToFrequency(note) * 0.98)).toBe(note);
        }
    });
});

describe("detectPitch", () => {
    it("recovers piano-range notes to the right semitone", () => {
        // A2 through C6 — the range practice pieces actually occupy.
        for (const note of [45, 48, 57, 60, 69, 72, 84]) {
            const freq = detectPitch(tone(midiToFrequency(note)), SAMPLE_RATE);
            expect(freq).not.toBeNull();
            expect(frequencyToMidi(freq!)).toBe(note);
        }
    });

    it("hears silence as nothing, not a phantom note", () => {
        expect(detectPitch(new Float32Array(2048), SAMPLE_RATE)).toBeNull();
        expect(detectPitch(tone(440, 2048, 0.001), SAMPLE_RATE)).toBeNull();
    });

    it("rejects noise instead of guessing a note", () => {
        const frame = new Float32Array(2048);
        // Deterministic pseudo-noise: no periodicity for the detector to find.
        let seed = 1;
        for (let i = 0; i < frame.length; i++) {
            seed = (seed * 16807) % 2147483647;
            frame[i] = (seed / 2147483647) * 0.6 - 0.3;
        }
        expect(detectPitch(frame, SAMPLE_RATE)).toBeNull();
    });
});

describe("createNoteTracker", () => {
    it("needs consecutive agreeing frames before a note sounds", () => {
        const tracker = createNoteTracker({ onFrames: 3, offFrames: 6 });
        expect(tracker.track(60)).toEqual([]);
        expect(tracker.track(60)).toEqual([]);
        expect(tracker.track(60)).toEqual([{ kind: "on", note: 60 }]);
        // The same sounding note re-detected changes nothing.
        expect(tracker.track(60)).toEqual([]);
    });

    it("shrugs off a single flaky frame mid-sustain", () => {
        const tracker = createNoteTracker({ onFrames: 3, offFrames: 6 });
        tracker.track(60);
        tracker.track(60);
        tracker.track(60);
        expect(tracker.track(null)).toEqual([]);
        expect(tracker.track(60)).toEqual([]);
    });

    it("releases after sustained silence", () => {
        const tracker = createNoteTracker({ onFrames: 1, offFrames: 3 });
        tracker.track(60);
        expect(tracker.track(null)).toEqual([]);
        expect(tracker.track(null)).toEqual([]);
        expect(tracker.track(null)).toEqual([{ kind: "off", note: 60 }]);
    });

    it("hands over to a new stable note with an off then an on", () => {
        const tracker = createNoteTracker({ onFrames: 2, offFrames: 6 });
        tracker.track(60);
        tracker.track(60);
        expect(tracker.track(62)).toEqual([]);
        expect(tracker.track(62)).toEqual([
            { kind: "off", note: 60 },
            { kind: "on", note: 62 },
        ]);
    });

    it("flushes the sounding note when the microphone stops", () => {
        const tracker = createNoteTracker({ onFrames: 1 });
        tracker.track(72);
        expect(tracker.flush()).toEqual([{ kind: "off", note: 72 }]);
        expect(tracker.flush()).toEqual([]);
    });
});
