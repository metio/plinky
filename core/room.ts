// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The room the piano is standing in, as an impulse response.
//
// Every voice used to go straight to the limiter and out — no space around it at all. A dry
// piano is the one thing no real piano ever is, and the ear reads the absence as "a
// computer" long before it notices anything about the timbre. This is what most cheaply
// separates "a piano" from "a piano in a room", and unlike a better voice it costs no
// download: the response is generated.
//
// Computed rather than recorded, and computed the SAME WAY EVERY TIME. The generator is
// seeded, so the app, a re-render of the same take, and an exported video all put the piano
// in one room. A response built from ambient randomness would give every export a slightly
// different space, and two renders of one take would not match.
//
// The shape is the ordinary one for a small hall: a few discrete early reflections — the
// walls, arriving distinctly — over a noise tail whose envelope decays exponentially to
// silence. Nothing here models a real geometry; it is the least that sounds like somewhere.

// How long the tail runs. Long enough to hear as a room rather than a slap, short enough
// that a run of quavers does not turn to soup.
export const ROOM_SECONDS = 1.6;

// The tail falls this far by the end. -60 dB is the conventional definition of a reverb
// time: past it the tail is inaudible under anything else being played.
const END_DB = -60;

// The walls: when the first distinct reflections arrive, and how loud, relative to the
// tail. Discrete taps rather than noise, because early reflections are what say "small
// room" rather than "large hall" — the tail alone reads as a cathedral.
const EARLY = [
    { seconds: 0.011, gain: 3 },
    { seconds: 0.019, gain: 2.2 },
    { seconds: 0.027, gain: 1.8 },
    { seconds: 0.041, gain: 1.2 },
];

// Sound takes time to come back off a wall, and the diffuse tail — many reflections piled
// up — takes longer still to build. Without the gap the noise starts at full height in the
// same instant as the note, which buries the early reflections underneath it and reads as a
// wash rather than a room. The tail is silent until the first wall answers, then builds over
// the span below.
const TAIL_FROM = 0.012;
const TAIL_BUILD = 0.03;

// A seeded generator, so the room is the same one on every device and in every export.
// mulberry32: small, fast, and good enough for noise nobody is going to analyse.
function seeded(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// One channel of the response. The two channels are generated from different seeds and are
// therefore uncorrelated, which is what gives the room width — the same noise in both ears
// is a room with no sides to it.
//
// `sampleRate` comes from the audio context, so a video export rendering at a different rate
// gets the same room rather than the same array of numbers played at the wrong speed.
export function roomImpulse(sampleRate: number, seed: number): Float32Array<ArrayBuffer> {
    const length = Math.max(1, Math.round(sampleRate * ROOM_SECONDS));
    const out = new Float32Array(length);
    const noise = seeded(seed);
    // exp(decay * t) reaching END_DB at the end of the tail.
    const decay = (END_DB / 20) * Math.LN10 / ROOM_SECONDS;
    for (let index = 0; index < length; index++) {
        const seconds = index / sampleRate;
        // Noise in -1..1, shaped by the decaying envelope, and held back until the room has
        // had time to answer at all.
        const build = Math.max(0, Math.min(1, (seconds - TAIL_FROM) / TAIL_BUILD));
        out[index] = (noise() * 2 - 1) * Math.exp(decay * seconds) * build;
    }
    for (const { seconds, gain } of EARLY) {
        const at = Math.round(seconds * sampleRate);
        if (at < length) {
            // Added to the tail rather than replacing it, and alternating in sign so the
            // taps do not sum into one thump at the front of the response.
            out[at] = (out[at] as number) + gain * (at % 2 === 0 ? 1 : -1);
        }
    }
    return normalized(out);
}

// Scaled to unit energy, so the wet level means the same thing whatever the sample rate or
// the tail length. Without this, a longer or denser response is simply a louder one, and
// the mix would have to be retuned every time the room was.
function normalized(samples: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
    let energy = 0;
    for (const sample of samples) {
        energy += sample * sample;
    }
    if (energy <= 0) {
        return samples;
    }
    const scale = 1 / Math.sqrt(energy);
    for (let index = 0; index < samples.length; index++) {
        samples[index] = (samples[index] as number) * scale;
    }
    return samples;
}
