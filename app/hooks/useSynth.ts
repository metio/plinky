// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback } from "react";
import { getAudioContext, midiToFrequency } from "../lib/audio";

export type PlayNoteOptions = {
    velocity?: number; // 0..127
    duration?: number; // seconds
};

export type UseSynthResult = {
    playNote: (note: number, options?: PlayNoteOptions) => void;
};

// A short plucked tone: a triangle fundamental with a quieter octave above for
// brightness, shaped by a quick attack and an exponential decay.
export function useSynth(): UseSynthResult {
    const playNote = useCallback((note: number, options: PlayNoteOptions = {}) => {
        const ctx = getAudioContext();
        if (!ctx) {
            return;
        }
        void ctx.resume();

        const now = ctx.currentTime;
        const duration = options.duration ?? 0.55;
        const peak = ((options.velocity ?? 90) / 127) * 0.3;
        const frequency = midiToFrequency(note);

        const envelope = ctx.createGain();
        // Exponential ramps cannot reach zero, so the envelope rides just above it.
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(peak, now + 0.01);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        envelope.connect(ctx.destination);

        const fundamental = ctx.createOscillator();
        fundamental.type = "triangle";
        fundamental.frequency.value = frequency;
        fundamental.connect(envelope);

        const overtone = ctx.createOscillator();
        overtone.type = "sine";
        overtone.frequency.value = frequency * 2;
        const overtoneGain = ctx.createGain();
        overtoneGain.gain.value = 0.3;
        overtone.connect(overtoneGain);
        overtoneGain.connect(envelope);

        fundamental.start(now);
        overtone.start(now);
        fundamental.stop(now + duration);
        overtone.stop(now + duration);
    }, []);

    return { playNote };
}
