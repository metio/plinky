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
// envelope (soft attack, fast initial decay to a sustain shelf, then a release
// tail that rings on past the note's notated length) and a low-pass filter that
// closes over time so the tone darkens as it rings out.
const PARTIALS: { ratio: number; gain: number; type: OscillatorType }[] = [
    { ratio: 1, gain: 1, type: "triangle" },
    { ratio: 2, gain: 0.45, type: "sine" },
    { ratio: 3, gain: 0.2, type: "sine" },
    { ratio: 4, gain: 0.1, type: "sine" },
];

// A real string keeps ringing after the key's notated length is over, and that
// overlap into the following note is what the ear reads as legato rather than a row
// of disconnected plucks. Each voice therefore holds its sustain shelf for the
// note's own `duration`, then rings out over this extra tail past it. Bass strings
// ring far longer than treble, so the tail scales with register: interpolated on a
// log-frequency scale between a long bass tail and a short treble one, clamped past
// the ~A2..~A6 endpoints. Exported so the envelope's ring-out is unit-testable.
export function releaseTail(frequency: number): number {
    const lowHz = 110; // ~A2
    const highHz = 1760; // ~A6
    const bassTail = 0.9;
    const trebleTail = 0.35;
    const span = Math.log2(highHz) - Math.log2(lowHz);
    const t = (Math.log2(frequency) - Math.log2(lowHz)) / span;
    const clamped = Math.max(0, Math.min(1, t));
    return bassTail + (trebleTail - bassTail) * clamped;
}

// The tail is capped by the fraction of a note it warrants below, so a short note keeps a
// crisp articulation instead of every note ringing out the same.
const TAIL_PER_DURATION = 0.6;
// A floor keeps even the shortest note's cutoff a smooth fade rather than a click.
const MIN_TAIL = 0.04;

// The ring-out a note actually gets: its register tail, but never longer than the note
// itself warrants. A short note — a staccato, or a note in a fast passage — is clipped to
// a crisp fraction of its own length so its articulation survives, while a held note rings
// its full register tail and connects into the next. Exported so the shaping is testable.
export function ringTail(frequency: number, duration: number): number {
    const proportional = Math.max(0, duration) * TAIL_PER_DURATION;
    return Math.max(MIN_TAIL, Math.min(releaseTail(frequency), proportional));
}

// A shared master limiter between every voice (and the metronome click) and the
// speakers, so overlapping release tails and dense chords can't stack past 0 dBFS
// into a clip, while a single note keeps its true dynamics untouched — the threshold
// sits just below full scale, so only genuine overload is caught. One per context:
// the shared live one, or the fresh offline one each video export builds, cached
// against it so it is wired only once.
const masters = new WeakMap<BaseAudioContext, AudioNode>();
function master(ctx: BaseAudioContext): AudioNode {
    const existing = masters.get(ctx);
    if (existing) {
        return existing;
    }
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    limiter.connect(ctx.destination);
    masters.set(ctx, limiter);
    return limiter;
}

// The voice is written against BaseAudioContext so the same synthesis renders
// live (AudioContext) and into a file (OfflineAudioContext, for video export) —
// one recipe, so an exported take sounds exactly like its in-app replay.
export function renderStrike(
    ctx: BaseAudioContext,
    { note, gain, duration, delay }: NoteStrike,
): void {
    const now = ctx.currentTime + Math.max(0, delay);
    const frequency = midiToFrequency(note);
    const tail = ringTail(frequency, duration);

    // The played length holds the note's shelf; the filter keeps closing across the
    // whole ring — the shelf plus its release tail — so the tone darkens all the way
    // out rather than snapping bright-to-gone at the notated end.
    const attackEnd = now + 0.012; // soft enough to lose the click, quick enough to feel struck
    const decayEnd = now + 0.18; // fast initial fall to the sustain shelf
    const holdUntil = now + duration; // the note's own notated length, held at the shelf
    const sustain = gain * 0.5;
    const releaseEnd = Math.max(holdUntil, decayEnd) + tail;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(frequency * 8, 12000), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 2, 400), releaseEnd);
    filter.connect(master(ctx));

    const envelope = ctx.createGain();
    // Exponential ramps cannot reach zero, so the envelope rides just above it.
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, attackEnd);
    envelope.gain.exponentialRampToValueAtTime(sustain, decayEnd);
    // Hold the shelf until the notated end when the note outlasts the decay, so the
    // release tail begins at `duration` rather than part-way through the note. A note
    // shorter than the decay never reaches the hold and releases straight on.
    if (holdUntil > decayEnd) {
        envelope.gain.setValueAtTime(sustain, holdUntil);
    }
    envelope.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
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
        // Keep the oscillator alive a hair past the tail so its stop never clips the
        // ring-out the envelope is still fading.
        oscillator.stop(releaseEnd + 0.03);
    }
}

// Live sustaining voices, keyed by MIDI note — one per note at a time; re-pressing a held
// note replaces it. A pressed voice holds its shelf until release rather than scheduling
// its own end, so the sound follows the player's own key hold; the release tail is scaled
// to how long it was actually held (ringTail), so a quick release sounds staccato and a
// long hold rings on. These live on the shared context; the offline export uses renderStrike.
type Voice = {
    envelope: GainNode;
    oscillators: OscillatorNode[];
    frequency: number;
    startedAt: number; // ctx.currentTime at press, for the held-scaled tail
};
const voices = new Map<number, Voice>();
// Notes whose key is physically down right now. A voice ends only once nothing holds it:
// not the key, not the sustain pedal, not the sostenuto pedal.
const keyDown = new Set<number>();
let sustainDown = false;
let softDown = false;
// The notes the sostenuto pedal captured when it was pressed — it holds only those.
let sostenutoHeld = new Set<number>();
// How much the soft (una corda) pedal gentles a note struck while it is held.
const SOFT_GAIN = 0.62;

// Whether anything still holds a note sounding — its key, the sustain pedal, or the
// sostenuto pedal's captured set. Every release path funnels through this, so the three
// pedals compose without each needing to know about the others.
function stillHeld(note: number): boolean {
    return keyDown.has(note) || sustainDown || sostenutoHeld.has(note);
}

function maybeEnd(ctx: AudioContext, note: number, holdScale = 1): void {
    if (!stillHeld(note)) {
        endVoice(ctx, note, holdScale);
    }
}

// A held voice: the same partials, attack and darkening filter as a struck note, but with
// no release scheduled — the shelf holds until fadeVoice rings it out.
function buildVoice(ctx: AudioContext, frequency: number, gain: number): Voice {
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(frequency * 8, 12000), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 2, 400), now + 0.6);
    filter.connect(master(ctx));

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(gain * 0.5, now + 0.18);
    envelope.connect(filter);

    const oscillators = PARTIALS.map((partial) => {
        const oscillator = ctx.createOscillator();
        oscillator.type = partial.type;
        oscillator.frequency.value = frequency * partial.ratio;
        oscillator.detune.value = (partial.ratio - 1) * 2;
        const partialGain = ctx.createGain();
        partialGain.gain.value = partial.gain;
        oscillator.connect(partialGain);
        partialGain.connect(envelope);
        oscillator.start(now);
        return oscillator;
    });
    return { envelope, oscillators, frequency, startedAt: now };
}

// The most extra body a generous release adds, so a lengthened tap sings without droning
// into the next note however the scale is set.
const MAX_HOLD_EXTRA = 0.28;

// Ring a voice out over `tail` seconds from wherever its envelope stands, then stop its
// oscillators just after — a quick fade when a re-press replaces it, the held-scaled tail
// on a real release. `hold` keeps the shelf sounding that many seconds before the ring-out
// begins, so an imprecise input's short press is let ring like a longer-held key.
function fadeVoice(ctx: AudioContext, voice: Voice, tail: number, hold = 0): void {
    const now = ctx.currentTime;
    const gain = voice.envelope.gain;
    const shelf = Math.max(0.0001, gain.value);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(shelf, now);
    // Hold the shelf flat until the ring-out starts, then fade from there.
    const fadeFrom = now + Math.max(0, hold);
    gain.setValueAtTime(shelf, fadeFrom);
    gain.exponentialRampToValueAtTime(0.0001, fadeFrom + tail);
    for (const oscillator of voice.oscillators) {
        oscillator.stop(fadeFrom + tail + 0.03);
    }
}

// Release a note's voice, ringing it out over a tail scaled to how long it was held.
// holdScale > 1 lets a short imprecise-input tap ring as if held that many times longer —
// a little extra body (capped) plus the correspondingly longer tail.
function endVoice(ctx: AudioContext, note: number, holdScale = 1): void {
    const voice = voices.get(note);
    if (!voice) {
        return;
    }
    const held = ctx.currentTime - voice.startedAt;
    const effective = held * holdScale;
    const extra = Math.min(Math.max(0, effective - held), MAX_HOLD_EXTRA);
    fadeVoice(ctx, voice, ringTail(voice.frequency, effective), extra);
    voices.delete(note);
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
    envelope.connect(master(ctx));
    osc.start(time);
    osc.stop(time + 0.06);
}

// When each pitch last started sounding plus how long it rings, on the wall
// clock — the echo probe below answers from this. A plain map stays tiny: one
// entry per distinct pitch ever struck this visit.
const struckUntil = new Map<number, number>();

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
            struckUntil.set(
                note.note,
                performance.now() + (Math.max(0, note.delay) + note.duration) * 1000,
            );
        }
    },
    press(note, gain) {
        const ctx = context();
        if (!ctx || gain <= 0) {
            return;
        }
        const existing = voices.get(note);
        if (existing) {
            // A re-press of a still-sounding note: fade the old voice fast so the new
            // strike lands cleanly rather than summing with a ghost of the last.
            fadeVoice(ctx, existing, 0.03);
        }
        keyDown.add(note);
        // The soft pedal gentles a note struck while it is held.
        voices.set(
            note,
            buildVoice(ctx, midiToFrequency(note), softDown ? gain * SOFT_GAIN : gain),
        );
        // The voice rings for at least ~1.5s; enough of a window for the mic echo probe,
        // which mic input skips anyway (a mic player hears their own piano, not this).
        struckUntil.set(note, performance.now() + 1500);
    },
    release(note, holdScale = 1) {
        const ctx = context();
        if (!ctx) {
            return;
        }
        // The key lifting only ends the note when no pedal is holding it. A generous
        // holdScale lets an imprecise input's short tap ring on; a pedal that later ends
        // this note uses the default scale, so a pedalled note isn't double-lengthened.
        keyDown.delete(note);
        maybeEnd(ctx, note, holdScale);
    },
    setPedal(kind, down) {
        const ctx = context();
        if (kind === "soft") {
            // Affects only notes struck while it is down, so nothing to re-end here.
            softDown = down;
            return;
        }
        if (kind === "sustain") {
            sustainDown = down;
            if (!down && ctx) {
                // Lifting the damper ends every voice nothing else is still holding.
                for (const note of [...voices.keys()]) {
                    maybeEnd(ctx, note);
                }
            }
            return;
        }
        // Sostenuto: pressing it captures the notes whose keys are down right now — the
        // raised dampers at that instant — and holds only those; later notes play normally.
        // Capturing every sounding voice instead would wrongly sustain notes still ringing
        // under the sustain pedal or a prior sostenuto. Lifting ends the captured set, save
        // any a key or the sustain pedal still holds.
        if (down) {
            sostenutoHeld = new Set(keyDown);
        } else {
            const held = sostenutoHeld;
            sostenutoHeld = new Set();
            if (ctx) {
                for (const note of held) {
                    maybeEnd(ctx, note);
                }
            }
        }
    },
    click(time, kind, gain) {
        const ctx = context();
        if (ctx && gain > 0) {
            click(ctx, time, kind, gain);
        }
    },
    recentlyStruck(note, withinMs) {
        const until = struckUntil.get(note);
        return until !== undefined && performance.now() < until + withinMs;
    },
};
