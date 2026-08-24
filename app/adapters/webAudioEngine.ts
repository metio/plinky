// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { midiToFrequency } from "../../core/pitch";
import type { AudioEngine, ClickKind, NoteStrike } from "../ports/audioEngine";
import { ROOM_SECONDS, ROOM_WET, roomImpulse } from "../../core/room";
import type { ExtraKind } from "../../core/sampledPiano";
import type { SampleLookup, SampleVoice } from "../ports/sampleSource";

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

// Where a NOTE goes: into the dry path and the room at once. Everything audible from the
// instrument passes through here.
//
// The metronome does not. A click is a piece of timekeeping equipment sitting outside the
// music, and putting it in the room smears the very edge a player is listening for — the
// one thing the click exists to give them. So clicks connect to `master` directly and stay
// dry, which is also how a real metronome sounds standing next to the piano.
const rooms = new WeakMap<BaseAudioContext, AudioNode>();
// The wet-mix node of each context's room, so the player's setting can move it. Kept beside
// the room rather than inside it because the setting can change while the room is standing.
const wets = new WeakMap<BaseAudioContext, GainNode>();
// The level a room is built at, and the one setRoom writes. Module-level because the room is
// built lazily on the first note and the setting is usually made before that.
let wetLevel = ROOM_WET;
function room(ctx: BaseAudioContext): AudioNode {
    const existing = rooms.get(ctx);
    if (existing) {
        return existing;
    }
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(master(ctx));

    const convolver = ctx.createConvolver();
    // The response is already scaled to unit energy in core, and the node's own
    // normalisation would undo that — leaving the wet level at the mercy of the tail's
    // length and the context's sample rate, which is exactly what unit energy is for.
    convolver.normalize = false;
    const impulse = ctx.createBuffer(
        2,
        Math.max(1, Math.round(ctx.sampleRate * ROOM_SECONDS)),
        ctx.sampleRate,
    );
    // A seed per channel, so the two ears hear uncorrelated noise and the room has width.
    impulse.copyToChannel(roomImpulse(ctx.sampleRate, LEFT_SEED), 0);
    impulse.copyToChannel(roomImpulse(ctx.sampleRate, RIGHT_SEED), 1);
    convolver.buffer = impulse;

    const wet = ctx.createGain();
    wet.gain.value = wetLevel;
    wets.set(ctx, wet);
    out.connect(convolver);
    convolver.connect(wet);
    wet.connect(master(ctx));

    rooms.set(ctx, out);
    return out;
}

const LEFT_SEED = 0x5eed;
const RIGHT_SEED = 0xf00d;

// The voice is written against BaseAudioContext so the same synthesis renders
// live (AudioContext) and into a file (OfflineAudioContext, for video export) —
// one recipe, so an exported take sounds exactly like its in-app replay.
// A struck note's live nodes and the time it finishes ringing, so a scheduled strike on the
// shared context can be found and silenced early (a fixed-length strike opens no voice, so
// allNotesOff otherwise can't reach it). The offline export ignores the return.
export type StruckStrike = {
    envelope: GainNode;
    // Oscillators for the synthesised voice, a buffer source for a recorded one. Both are
    // scheduled sources and the voice only ever starts and stops them.
    oscillators: AudioScheduledSourceNode[];
    releaseEnd: number;
};

export function renderStrike(
    ctx: BaseAudioContext,
    strike: NoteStrike,
    sample?: SampleVoice,
): StruckStrike {
    if (sample) {
        return renderSampledStrike(ctx, strike, sample);
    }
    const { note, gain, duration, delay } = strike;
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
    filter.connect(room(ctx));

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

    const oscillators = PARTIALS.map((partial) => {
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
        return oscillator;
    });
    return { envelope, oscillators, releaseEnd };
}

// A struck note played from a recording of a piano.
//
// The recording already carries the attack, the timbre and the decay of a real string
// struck that hard — everything the synthesised voice has to imitate with an envelope and
// a filter — so there is nothing to shape but the ending. A key that comes up before the
// recording has decayed gets the damper: a short fall rather than a cut, because a hard
// edge on a ringing string is a click and a piano makes no such sound.
//
// The velocity is already in the choice of recording, so the gain here is only what the
// caller's volume setting asks for, not the dynamic.
const DAMPER_S = 0.35;

// A recording is made at the dynamic it was played at, so the loudness that belongs to a
// sampled note is the volume preference alone. The caller folds velocity into `gain`, which
// is right for a synthesised voice and would be applied twice here — a soft note picking a
// soft recording and then being turned down again. This takes the velocity back out and
// leaves the preference.
//
// The trim is what keeps a ten-note chord of real piano off the limiter: the recordings
// reach for the whole scale where the synth's partials sit well under it.
const SAMPLE_TRIM = 1.9;

function sampledLevel(gain: number, velocity: number): number {
    const preference = velocity > 0 ? gain * (127 / velocity) : gain;
    return Math.min(1, preference * SAMPLE_TRIM);
}

function renderSampledStrike(
    ctx: BaseAudioContext,
    { note, gain, velocity, duration, delay, pedalled }: NoteStrike,
    sample: SampleVoice,
): StruckStrike {
    const now = ctx.currentTime + Math.max(0, delay);
    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.value = sample.rate;

    const level = sampledLevel(gain, velocity);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(level, now);
    const damperFrom = now + Math.max(0.05, duration);
    envelope.gain.setValueAtTime(level, damperFrom);
    envelope.gain.exponentialRampToValueAtTime(0.0001, damperFrom + DAMPER_S);
    envelope.connect(room(ctx));
    // NO key-off knock here, and the reason is worth keeping. A knock is the damper landing,
    // and on a real instrument it is a sparse sound: it needs a key to come up with nothing
    // else holding it, which under hands happens far less often than notes are played. A
    // scheduled note has no such test — every one of them ends at a known time — so knocking
    // with each produced one broadband click per note, several at once under a chord, and a
    // continuous click train through anything fast. It measured as a wash of transients
    // across the whole top of the spectrum, over the music.
    //
    // The live press-and-release path keeps its knock, where the damper genuinely lands and
    // the player's own hands set the rate.
    // Struck with the dampers off, so the rest of the instrument answers. Same instant as
    // the note, not the damper.
    if (pedalled) {
        scheduleExtra(ctx, note, "resonance", level * RESONANCE_LEVEL, now);
    }

    source.connect(envelope);
    source.start(now);
    const releaseEnd = damperFrom + DAMPER_S;
    source.stop(releaseEnd + 0.03);
    return { envelope, oscillators: [source], releaseEnd };
}

// Live sustaining voices, keyed by MIDI note — one per note at a time; re-pressing a held
// note replaces it. A pressed voice holds its shelf until release rather than scheduling
// its own end, so the sound follows the player's own key hold; the release tail is scaled
// to how long it was actually held (ringTail), so a quick release sounds staccato and a
// long hold rings on. These live on the shared context; the offline export uses renderStrike.
type Voice = {
    envelope: GainNode;
    // Oscillators for the synthesised voice, one buffer source for a recorded one. Both are
    // scheduled sources, and a held voice only ever starts and stops them.
    oscillators: AudioScheduledSourceNode[];
    frequency: number;
    startedAt: number; // ctx.currentTime at press, for the held-scaled tail
    // A recording rings the way the string did; there is no synthesised tail to model, so
    // the ending is a damper falling and nothing else.
    sampled?: boolean;
    // The loudness this voice was played at, with the volume preference already in it. The
    // key-off knock and the pedal's resonance are scaled off it, so they follow the note
    // they belong to — and a muted session, whose notes never sound, makes no mechanism
    // noise either, without either of them having to know what muted means.
    level: number;
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

// A held voice played from a recording of a real piano. The recording carries the attack
// and the decay of a string struck that hard, so nothing is shaped on the way in: it starts
// at the level the volume preference asks for and holds until the key comes up. That is the
// whole difference between a sampled piano and a synthesised one — there is nothing to
// imitate, only something to stop.
function buildSampledVoice(
    ctx: AudioContext,
    frequency: number,
    gain: number,
    velocity: number,
    sample: SampleVoice,
): Voice {
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.value = sample.rate;

    // One reading of the level, used both to open the envelope and to report what the
    // voice is holding: two calls could only ever agree, and a change to one is a change
    // the other silently disagrees with.
    const level = sampledLevel(gain, velocity);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(level, now);
    envelope.connect(room(ctx));
    source.connect(envelope);
    source.start(now);
    // Long enough that a held key never runs out of recording before the player lifts it;
    // the buffer simply ends if they hold it longer than the string rang.
    source.stop(now + sample.buffer.duration);
    return {
        envelope,
        oscillators: [source],
        frequency,
        startedAt: now,
        sampled: true,
        level,
    };
}

// A held voice: the same partials, attack and darkening filter as a struck note, but with
// no release scheduled — the shelf holds until fadeVoice rings it out.
function buildVoice(ctx: AudioContext, frequency: number, gain: number): Voice {
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(frequency * 8, 12000), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 2, 400), now + 0.6);
    filter.connect(room(ctx));

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
    return { envelope, oscillators, frequency, startedAt: now, level: gain };
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
// A piano is an object somebody is operating, and the key coming up is audible: the damper
// lands on the string and the mechanism returns. The pack records that as its `knock`, and
// it is a large part of why a sampled piano sounds like a room with a piano in it rather
// than a tone generator with good tone.
//
// Quiet, because it is mechanism rather than music, and scaled by the volume preference like
// everything else. Not by velocity: how hard the key went DOWN says nothing about the noise
// it makes coming UP.
const KNOCK_LEVEL = 0.22;

// The other strings answering a struck one, which is what the sustain pedal actually sounds
// like beyond "notes last longer". Quieter still — it is a wash under the note, and at any
// audible level it turns a pedalled passage to fog.
const RESONANCE_LEVEL = 0.11;

// One of the pack's extra recordings, played once and left to ring out on its own. It opens
// no voice and is never tracked: there is nothing to release, nothing to pedal, and
// allNotesOff has nothing to silence — it is over in a fraction of a second either way.
function scheduleExtra(
    ctx: BaseAudioContext,
    note: number,
    kind: ExtraKind,
    level: number,
    at: number,
): void {
    // Velocity is not how hard the key came UP, and a knock is the same sound however hard
    // the note was struck — so the lookup asks at a middling force and takes whatever
    // recording covers the key.
    const sample = samples?.().source?.extraFor(note, 90, kind) ?? null;
    if (!sample || level <= 0) {
        return;
    }
    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.value = sample.rate;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(level, at);
    envelope.connect(room(ctx));
    source.connect(envelope);
    source.start(at);
    source.stop(at + sample.buffer.duration);
}

// The live case: right now, on the shared context.
function playExtra(ctx: AudioContext, note: number, kind: ExtraKind, level: number): void {
    scheduleExtra(ctx, note, kind, level, ctx.currentTime);
}

function endVoice(ctx: AudioContext, note: number, holdScale = 1): void {
    const voice = voices.get(note);
    if (!voice) {
        return;
    }
    // Only for a recorded instrument, and only where the damper genuinely lands — this is
    // reached through maybeEnd, which stands down while a key or a pedal still holds the
    // note. A knock under the sustain pedal would be a sound no piano makes.
    if (voice.sampled) {
        playExtra(ctx, note, "knock", voice.level * KNOCK_LEVEL);
    }
    const held = ctx.currentTime - voice.startedAt;
    const effective = held * holdScale;
    const extra = Math.min(Math.max(0, effective - held), MAX_HOLD_EXTRA);
    // A recording is the string's own ring, so the ending is the damper landing on it —
    // one fall, the same for every note. The synthesised voice models a tail instead,
    // because it has none of its own.
    const tail = voice.sampled ? DAMPER_S : ringTail(voice.frequency, effective);
    fadeVoice(ctx, voice, tail, extra);
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
    // Dry, deliberately: see room(). A click in the room smears the edge it exists to give.
    envelope.connect(master(ctx));
    osc.start(time);
    osc.stop(time + 0.06);
}

// When each pitch last started sounding plus how long it rings, on the wall
// clock — the echo probe below answers from this. A plain map stays tiny: one
// entry per distinct pitch ever struck this visit.
const struckUntil = new Map<number, number>();

// Fixed-length struck notes still ringing (or scheduled ahead by a delay) on the shared
// live context. Unlike a pressed voice they open no entry in `voices`, so allNotesOff can
// only silence them by tracking them here; each removes itself once its ring-out ends.
const scheduledStrikes = new Set<StruckStrike>();

// Ring out and stop every scheduled/ringing struck note now — the strike counterpart to
// fading the live voices. A strike still waiting on its delay has not ramped up yet, so the
// fast fade lands it silent, and stopping an oscillator before its start time simply keeps
// it from ever sounding.
function silenceStrikes(ctx: AudioContext): void {
    const now = ctx.currentTime;
    for (const strike of scheduledStrikes) {
        const gain = strike.envelope.gain;
        const shelf = Math.max(0.0001, gain.value);
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(shelf, now);
        gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        for (const oscillator of strike.oscillators) {
            try {
                oscillator.stop(now + 0.11);
            } catch {
                // Already stopped — harmless.
            }
        }
    }
    scheduledStrikes.clear();
}

// The context the engine plays through, for whatever has to decode into it: an AudioBuffer
// belongs to the context that made it, so the recordings cannot be decoded anywhere else.
export function audioContext(): BaseAudioContext | null {
    return context();
}

// The recordings, when the player has asked for them and this note's arrived. Set at the
// composition root rather than imported, so the engine keeps its one job — making a sound —
// and never reaches for a cache itself.
//
// A note-on asks and takes what is there THIS INSTANT: a recording still being fetched is a
// note the synthesised voice plays, and the difference between the two is smaller than the
// difference between a note that sounds and one that waits.
let samples: (() => { source: SampleLookup | null }) | null = null;

// Hand the engine the recordings to play from. Not a hook and not a subscription: one
// module-level wire, set once at the composition root.
export function playFromSamples(lookup: () => { source: SampleLookup | null }): void {
    samples = lookup;
}

// The recording for a note, or nothing. Exported so the offline render behind the video
// export plays the same instrument the speakers just did — an exported take that sounds
// different from the take is a bug nobody would report as one.
export function sampleVoiceFor(pitch: number, velocity: number): SampleVoice | undefined {
    return voiceFor(pitch, velocity);
}

function voiceFor(pitch: number, velocity: number): SampleVoice | undefined {
    return (
        samples?.().source?.voiceFor(pitch, Math.max(1, Math.min(127, Math.round(velocity)))) ??
        undefined
    );
}

export const webAudioEngine: AudioEngine = {
    now() {
        return context()?.currentTime ?? null;
    },
    running() {
        return sharedContext?.state === "running";
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
            // The knock and, where the score pedals it, the resonance are scheduled by
            // renderStrike alongside the note — one place, so an exported video carries
            // them exactly as the speakers just did.
            const strike = renderStrike(ctx, note, voiceFor(note.note, note.velocity));
            scheduledStrikes.add(strike);
            // Drop it from the tracked set once it has finished ringing, so the set holds
            // only strikes that are still (or not yet) sounding.
            strike.oscillators.at(-1)?.addEventListener("ended", () => {
                scheduledStrikes.delete(strike);
            });
            struckUntil.set(
                note.note,
                performance.now() + (Math.max(0, note.delay) + note.duration) * 1000,
            );
        }
    },
    press(note, gain, velocity) {
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
        const level = softDown ? gain * SOFT_GAIN : gain;
        const sample = voiceFor(note, velocity);
        voices.set(
            note,
            sample
                ? buildSampledVoice(ctx, midiToFrequency(note), level, velocity, sample)
                : buildVoice(ctx, midiToFrequency(note), level),
        );
        // Struck with the dampers off, so the rest of the instrument answers. The live
        // counterpart of the `pedalled` flag a Listen strike carries: here the player is
        // genuinely holding the pedal, so the engine's own state is the truth.
        if (sample && sustainDown) {
            playExtra(ctx, note, "resonance", sampledLevel(level, velocity) * RESONANCE_LEVEL);
        }
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
            // A second press re-snapshots, and anything leaving the captured set has to be
            // let go of on the way out. Overwriting the set silently orphaned notes whose
            // keys were already up and which nothing else held: a synthesised voice
            // schedules no stop of its own, so it stayed in `voices` sounding at its
            // sustain shelf until some unrelated allNotesOff happened along. Pedal-down
            // events are not deduplicated — any CC66 at or above 64 is another down, which
            // a half-pedal ramp sends several of.
            const previous = sostenutoHeld;
            sostenutoHeld = new Set(keyDown);
            if (ctx) {
                for (const note of previous) {
                    if (!sostenutoHeld.has(note)) {
                        maybeEnd(ctx, note);
                    }
                }
            }
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
    allNotesOff() {
        const ctx = context();
        if (ctx) {
            // Ring each voice out fast so the panic is a clean stop, not a click, then
            // drop it — the oscillators stop just after the short fade.
            for (const voice of voices.values()) {
                fadeVoice(ctx, voice, 0.08);
            }
            // A fixed-length strike opens no voice, so silence the scheduled/ringing ones
            // too — otherwise a note scheduled ahead would sound on past the panic.
            silenceStrikes(ctx);
        }
        // Clear all state regardless of context so a later press starts fresh and no
        // stale key/pedal flag keeps a future voice alive.
        voices.clear();
        keyDown.clear();
        sustainDown = false;
        softDown = false;
        sostenutoHeld = new Set();
    },
    setRoom(wet) {
        wetLevel = Math.max(0, wet);
        // The context already open, never a new one: a setting changed before the first
        // gesture must not be what opens audio, and there is no room to move yet anyway.
        const ctx = sharedContext;
        const node = ctx ? wets.get(ctx) : undefined;
        // Ramped rather than set: a jump in the wet mix while notes are ringing is an
        // audible step in the tail. Nothing to move if no room has been built yet — the
        // level above is what the next one is built at.
        node?.gain.setTargetAtTime(wetLevel, ctx?.currentTime ?? 0, 0.02);
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
