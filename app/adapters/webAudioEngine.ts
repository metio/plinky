// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { midiToFrequency } from "../../core/pitch";
import type { AudioEngine, ClickKind, NoteStrike } from "../ports/audioEngine";

// The Web Audio implementation of the sound seam: one shared AudioContext (a
// browser limits how many a page may open, and one context keeps the metronome
// click and the synthesized notes on the same clock) plus the synthesis graphs.

let sharedContext: AudioContext | null = null;

function context(): AudioContext | null {
    if (typeof window === "undefined") {
        return null;
    }
    if (!sharedContext) {
        // Older Safari only exposes webkitAudioContext; construction can also throw
        // when the browser's context limit is reached. Callers handle a null result.
        const Ctor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        try {
            sharedContext = Ctor ? new Ctor() : null;
        } catch {
            sharedContext = null;
        }
    }
    return sharedContext;
}

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

function strike(ctx: AudioContext, { note, gain, duration, delay }: NoteStrike): void {
    const now = ctx.currentTime + Math.max(0, delay);
    const frequency = midiToFrequency(note);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(frequency * 8, 12000), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 2, 400), now + duration);
    filter.connect(ctx.destination);

    const envelope = ctx.createGain();
    // Exponential ramps cannot reach zero, so the envelope rides just above it.
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.006);
    envelope.gain.exponentialRampToValueAtTime(gain * 0.5, now + 0.18);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    envelope.connect(filter);

    for (const partial of PARTIALS) {
        const oscillator = ctx.createOscillator();
        oscillator.type = partial.type;
        oscillator.frequency.value = frequency * partial.ratio;
        oscillator.detune.value = (partial.ratio - 1) * 2; // mild inharmonicity for warmth
        const partialGain = ctx.createGain();
        partialGain.gain.value = partial.gain;
        oscillator.connect(partialGain);
        partialGain.connect(envelope);
        oscillator.start(now);
        oscillator.stop(now + duration);
    }
}

function click(ctx: AudioContext, time: number, kind: ClickKind, gain: number): void {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.frequency.value = kind === "accent" ? 1600 : kind === "beat" ? 1000 : 800;
    // A short percussive blip; exponential ramps can't reach 0, so ride just above it.
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(envelope);
    envelope.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
}

export const webAudioEngine: AudioEngine = {
    now() {
        return context()?.currentTime ?? null;
    },
    resume() {
        context()
            ?.resume()
            .catch(() => {});
    },
    strike(note) {
        const ctx = context();
        if (ctx && note.gain > 0) {
            strike(ctx, note);
        }
    },
    click(time, kind, gain) {
        const ctx = context();
        if (ctx && gain > 0) {
            click(ctx, time, kind, gain);
        }
    },
};
