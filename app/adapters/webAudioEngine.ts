// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { midiToFrequency } from "../../core/pitch";
import type { AudioEngine, ClickKind, NoteStrike } from "../ports/audioEngine";

// The Web Audio implementation of the sound seam: one shared AudioContext (a
// browser limits how many a page may open, and one context keeps the metronome
// click and the synthesized notes on the same clock) plus the synthesis graphs.

let sharedContext: AudioContext | null = null;

// Declare the page a "playback" audio session so iOS Safari stops routing Web
// Audio through the ringer channel that Silent Mode mutes — the one clean, first-
// party way to make the synth audible with the silent switch / Action button on.
// It is WebKit-only (iOS 16.4+, ~all current iOS users) and a no-op everywhere
// else, which is fine: no other engine mutes Web Audio for Silent Mode. Takes the
// navigator as an argument so the decision is testable without a browser global.
// Returns whether the session type was set.
export function preferPlaybackSession(nav: unknown): boolean {
    const session = (nav as { audioSession?: { type?: string } } | null | undefined)?.audioSession;
    if (!session || typeof session.type !== "string") {
        return false;
    }
    if (session.type === "playback") {
        // Already declared — assigning again would needlessly re-negotiate the audio
        // route, so this stays cheap enough to call on every gesture and recovery.
        return true;
    }
    try {
        session.type = "playback";
        return true;
    } catch {
        // A browser that exposes audioSession read-only still gets the resume path.
        return false;
    }
}

// Re-assert the playback session; a no-op once it is already set. Guarded here so
// both the gesture path and the interruption-recovery path can call it freely.
function configureSession(): void {
    if (typeof navigator !== "undefined") {
        preferPlaybackSession(navigator);
    }
}

// A context suspended by an interruption — a phone call, Siri, a route change, the
// tab going to the background — must be nudged back to running or the next sound is
// lost. iOS may also drop the playback session across the interruption, so re-assert
// it before resuming. Only worth attempting while the page is visible; a resume that
// iOS still gates behind a gesture is a harmless no-op until the next tap re-runs
// unlock().
function nudge(): void {
    if (!sharedContext || sharedContext.state === "running") {
        return;
    }
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
    }
    configureSession();
    sharedContext.resume().catch(() => {});
}

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
        // iOS parks the context in "interrupted"/"suspended" across audio
        // interruptions; recover the moment the browser reports the transition.
        sharedContext?.addEventListener?.("statechange", nudge);
    }
    return sharedContext;
}

// The context only needs the silent priming buffer once — the first gesture that
// plays it moves iOS Safari's context out of suspended for the rest of the visit.
let primed = false;

// Play a one-sample silent buffer. Some iOS versions only transition a context to
// `running` once a buffer has actually started, so this rides alongside resume()
// on the first gesture. A browser that refuses the source still got the resume.
function prime(ctx: AudioContext): void {
    if (primed) {
        return;
    }
    primed = true;
    try {
        const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
    } catch {
        // Leave `primed` true: a browser that rejects the buffer source will
        // reject a retry too, and resume() is what matters on it anyway.
    }
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

// The voice is written against BaseAudioContext so the same synthesis renders
// live (AudioContext) and into a file (OfflineAudioContext, for video export) —
// one recipe, so an exported take sounds exactly like its in-app replay.
export function renderStrike(
    ctx: BaseAudioContext,
    { note, gain, duration, delay }: NoteStrike,
): void {
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
    unlock() {
        const ctx = context();
        if (!ctx) {
            return;
        }
        // Re-assert the session, resume, and prime on every call so a tap after an
        // interruption re-wakes a context iOS had suspended and reinstates the
        // playback session iOS may have dropped. configureSession no-ops once set.
        configureSession();
        ctx.resume().catch(() => {});
        prime(ctx);
    },
    strike(note) {
        const ctx = context();
        if (ctx && note.gain > 0) {
            renderStrike(ctx, note);
        }
    },
    click(time, kind, gain) {
        const ctx = context();
        if (ctx && gain > 0) {
            click(ctx, time, kind, gain);
        }
    },
};
