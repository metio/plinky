// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    createNoteTracker,
    detectPitches,
    levelToVelocity,
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
        expect(tracker.track([60])).toEqual([]);
        expect(tracker.track([60])).toEqual([]);
        expect(tracker.track([60])).toEqual([{ kind: "on", note: 60, velocity: 35 }]);
        // The same sounding note re-detected changes nothing.
        expect(tracker.track([60])).toEqual([]);
    });

    it("shrugs off a single flaky frame mid-sustain", () => {
        const tracker = createNoteTracker({ onFrames: 3, offFrames: 6 });
        tracker.track([60]);
        tracker.track([60]);
        tracker.track([60]);
        expect(tracker.track([])).toEqual([]);
        expect(tracker.track([60])).toEqual([]);
    });

    it("releases after sustained silence", () => {
        const tracker = createNoteTracker({ onFrames: 1, offFrames: 3 });
        tracker.track([60]);
        expect(tracker.track([])).toEqual([]);
        expect(tracker.track([])).toEqual([]);
        expect(tracker.track([])).toEqual([{ kind: "off", note: 60 }]);
    });

    it("hands over to a new note: the new one sounds, the old lingers out", () => {
        const tracker = createNoteTracker({ onFrames: 2, offFrames: 3 });
        tracker.track([60]);
        tracker.track([60]);
        expect(tracker.track([62])).toEqual([]);
        // The new note earns its on; the old one is released by its own
        // hysteresis a couple of frames later, not forced out.
        expect(tracker.track([62])).toEqual([{ kind: "on", note: 62, velocity: 35 }]);
        expect(tracker.track([62])).toEqual([{ kind: "off", note: 60 }]);
    });

    it("hears a chord as independent notes that need not land together", () => {
        const tracker = createNoteTracker({ onFrames: 2, offFrames: 3 });
        expect(tracker.track([60])).toEqual([]);
        expect(tracker.track([60, 64])).toEqual([{ kind: "on", note: 60, velocity: 35 }]);
        expect(tracker.track([60, 64, 67])).toEqual([{ kind: "on", note: 64, velocity: 35 }]);
        expect(tracker.track([60, 64, 67])).toEqual([{ kind: "on", note: 67, velocity: 35 }]);
        // Lifting the whole chord releases every voice once the linger passes.
        tracker.track([]);
        tracker.track([]);
        const offs = tracker.track([]);
        expect(new Set(offs.map((event) => event.note))).toEqual(new Set([60, 64, 67]));
        expect(offs.every((event) => event.kind === "off")).toBe(true);
    });

    it("caps simultaneous voices at maxNotes so phantoms can't pile up", () => {
        const tracker = createNoteTracker({ onFrames: 1, maxNotes: 2 });
        expect(tracker.track([60, 64, 67]).map((event) => event.note)).toEqual([60, 64]);
    });

    it("flushes the sounding note when the microphone stops", () => {
        const tracker = createNoteTracker({ onFrames: 1 });
        tracker.track([72]);
        expect(tracker.flush()).toEqual([{ kind: "off", note: 72 }]);
        expect(tracker.flush()).toEqual([]);
    });
});

describe("detectPitches", () => {
    // Two tones mixed into one frame — a played interval reaching the mic.
    function mix(a: number, b: number): Float32Array {
        const one = tone(midiToFrequency(a), 2048, 0.4);
        const two = tone(midiToFrequency(b), 2048, 0.4);
        const frame = new Float32Array(2048);
        for (let i = 0; i < frame.length; i++) {
            frame[i] = one[i]! + two[i]!;
        }
        return frame;
    }

    it("hears a single note as exactly one note", () => {
        expect(detectPitches(tone(midiToFrequency(60)), SAMPLE_RATE)).toEqual([60]);
    });

    it("hears silence as no notes at all", () => {
        expect(detectPitches(new Float32Array(2048), SAMPLE_RATE)).toEqual([]);
    });

    it("separates a wide two-note interval", () => {
        // C4 + E5 — far enough apart that their harmonic stacks are distinct.
        const heard = detectPitches(mix(60, 76), SAMPLE_RATE);
        expect(heard).toContain(60);
        expect(heard).toContain(76);
    });

    it("never invents a third note for a two-note interval", () => {
        const heard = detectPitches(mix(60, 76), SAMPLE_RATE);
        expect(heard.length).toBeLessThanOrEqual(3);
        for (const note of heard) {
            expect([60, 76]).toContain(note);
        }
    });
});

describe("levelToVelocity", () => {
    it("maps loudness onto a friendly velocity band, never past its edges", () => {
        expect(levelToVelocity(0)).toBe(35);
        expect(levelToVelocity(0.005)).toBe(35);
        expect(levelToVelocity(5)).toBe(112);
        // Louder frames read as harder strikes.
        expect(levelToVelocity(0.2)).toBeGreaterThan(levelToVelocity(0.05));
        expect(levelToVelocity(0.05)).toBeGreaterThan(levelToVelocity(0.02));
    });

    it("threads the struck loudness through to the note-on event", () => {
        const tracker = createNoteTracker({ onFrames: 2 });
        tracker.track([60], 0.05);
        const [on] = tracker.track([60], 0.2);
        expect(on).toMatchObject({ kind: "on", note: 60 });
        // The peak frame during establishment decides — not the last one.
        const loud = tracker.flush();
        expect(loud).toHaveLength(1);
        expect(on?.velocity).toBe(levelToVelocity(0.2));
    });
});
