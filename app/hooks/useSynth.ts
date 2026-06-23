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

// A piano-like voice synthesized in the Web Audio graph (no sample assets, so it
// stays small and works offline): a stack of harmonic partials whose higher
// overtones are quieter and slightly inharmonic, shaped by a hammer-strike
// envelope (near-instant attack, fast initial decay, longer release) and a
// low-pass filter that closes over time so the tone darkens as it rings out.
const PARTIALS: { ratio: number; gain: number; type: OscillatorType }[] = [
    { ratio: 1, gain: 1, type: "triangle" },
    { ratio: 2, gain: 0.45, type: "sine" },
    { ratio: 3, gain: 0.2, type: "sine" },
    { ratio: 4, gain: 0.1, type: "sine" },
];

export function useSynth(): UseSynthResult {
    const playNote = useCallback((note: number, options: PlayNoteOptions = {}) => {
        const ctx = getAudioContext();
        if (!ctx) {
            return;
        }
        void ctx.resume();

        const now = ctx.currentTime;
        const duration = options.duration ?? 1.1;
        const peak = ((options.velocity ?? 90) / 127) * 0.32;
        const frequency = midiToFrequency(note);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(frequency * 8, 12000), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 2, 400), now + duration);
        filter.connect(ctx.destination);

        const envelope = ctx.createGain();
        // Exponential ramps cannot reach zero, so the envelope rides just above it.
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(peak, now + 0.006);
        envelope.gain.exponentialRampToValueAtTime(peak * 0.5, now + 0.18);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        envelope.connect(filter);

        for (const { ratio, gain, type } of PARTIALS) {
            const oscillator = ctx.createOscillator();
            oscillator.type = type;
            oscillator.frequency.value = frequency * ratio;
            oscillator.detune.value = (ratio - 1) * 2; // mild inharmonicity for warmth
            const partialGain = ctx.createGain();
            partialGain.gain.value = gain;
            oscillator.connect(partialGain);
            partialGain.connect(envelope);
            oscillator.start(now);
            oscillator.stop(now + duration);
        }
    }, []);

    return { playNote };
}
