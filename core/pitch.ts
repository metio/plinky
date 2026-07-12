// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The semitone offset of each natural note letter above C — the shared base every
// MusicXML reader adds <octave> and <alter> to when turning a written pitch into a
// MIDI number. One definition so the parsers can't drift apart.
export const STEP_SEMITONES: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};

// MIDI note 69 is A4 = 440 Hz; every semitone is a factor of 2^(1/12).
export function midiToFrequency(note: number): number {
    return 440 * 2 ** ((note - 69) / 12);
}

// The nearest MIDI note for a sounding frequency — the inverse of
// midiToFrequency, rounded so anything within a quarter tone snaps to the note
// the player meant.
export function frequencyToMidi(freq: number): number {
    return Math.round(69 + 12 * Math.log2(freq / 440));
}

// ---------------------------------------------------------------------------
// Microphone pitch detection: turn a frame of audio samples into a MIDI note,
// and a stream of frames into stable note-on/off events. The design bias
// throughout is HEADROOM — a wobbly detection must read as the note the player
// meant, or as nothing, never as a wrong note — because playing an acoustic
// piano into a laptop microphone has to stay fun.

// The range a practice piece realistically occupies. Below A1 a microphone
// frame short enough for live feedback can't resolve the fundamental reliably;
// above A7 nothing in the catalogue lives.
const MIN_FREQ = 55; // A1
const MAX_FREQ = 3520; // A7

// How much of the frame's own energy a lag must retain to count as periodic.
// Generous: quiet uprights and phone microphones correlate weakly.
const CLARITY_THRESHOLD = 0.4;

// Frames quieter than this are silence — nobody played anything.
export const SILENCE_RMS = 0.01;

export function rms(frame: Float32Array): number {
    let sum = 0;
    for (const sample of frame) {
        sum += sample * sample;
    }
    return Math.sqrt(sum / (frame.length || 1));
}

// The frequency sounding in `frame`, or null for silence and noise. Plain
// normalized autocorrelation, taking the first strong peak after the curve
// first drops (the global maximum tends to land an octave low on bright piano
// tones), sharpened by parabolic interpolation — dependency-free, fast enough
// per animation frame, and accurate to well under a semitone where it matters.
export function detectPitch(frame: Float32Array, sampleRate: number): number | null {
    if (rms(frame) < SILENCE_RMS) {
        return null;
    }
    const minLag = Math.floor(sampleRate / MAX_FREQ);
    const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQ), Math.floor(frame.length / 2));
    if (minLag >= maxLag) {
        return null;
    }

    let energy = 0;
    for (const sample of frame) {
        energy += sample * sample;
    }
    const at = (lag: number) => {
        let correlation = 0;
        for (let i = 0; i < frame.length - lag; i++) {
            correlation += frame[i]! * frame[i + lag]!;
        }
        return correlation / energy;
    };

    let bestLag = -1;
    let bestValue = 0;
    let descended = false;
    let previous = 1;
    for (let lag = minLag; lag <= maxLag; lag++) {
        const normalized = at(lag);
        if (!descended && normalized < previous && normalized < CLARITY_THRESHOLD / 2) {
            descended = true;
        }
        if (descended && normalized > bestValue) {
            bestValue = normalized;
            bestLag = lag;
        }
        previous = normalized;
    }
    if (bestLag < 0 || bestValue < CLARITY_THRESHOLD) {
        return null;
    }

    // A whole sample of lag error is audible at the top of the range; the
    // parabola through the peak and its neighbours refines it to a fraction.
    const left = at(Math.max(bestLag - 1, minLag));
    const right = at(Math.min(bestLag + 1, maxLag));
    const denominator = 2 * (2 * bestValue - left - right);
    const shift = denominator !== 0 ? (right - left) / denominator : 0;
    const lag = bestLag + Math.max(-0.5, Math.min(0.5, shift));

    const freq = sampleRate / lag;
    return freq >= MIN_FREQ && freq <= MAX_FREQ ? freq : null;
}

export type PitchEvent = { kind: "on" | "off"; note: number };

export type TrackerOptions = {
    // Consecutive frames agreeing on a note before it sounds. Low enough to
    // feel immediate at ~60 frames a second, high enough that a transient
    // can't fire a phantom note.
    onFrames?: number;
    // Consecutive frames of anything else before the note releases. Generous,
    // so one dropped frame mid-sustain doesn't stutter the note off.
    offFrames?: number;
};

// Folds a per-frame detection stream into note events with hysteresis. One
// note at a time — chords are out of scope for the first microphone stage —
// and re-detection of the same sounding note is quietly absorbed.
export function createNoteTracker(options: TrackerOptions = {}) {
    const onFrames = options.onFrames ?? 3;
    const offFrames = options.offFrames ?? 6;
    let sounding: number | null = null;
    let candidate: number | null = null;
    let candidateRun = 0;
    let awayRun = 0;

    return {
        // Feed one frame's detection (null = silence/noise); collect the
        // events it settles into.
        track(note: number | null): PitchEvent[] {
            const events: PitchEvent[] = [];

            if (note !== null && note === sounding) {
                awayRun = 0;
                candidate = null;
                candidateRun = 0;
                return events;
            }
            if (sounding !== null) {
                awayRun++;
            }

            if (note !== null) {
                candidateRun = note === candidate ? candidateRun + 1 : 1;
                candidate = note;
            } else {
                candidate = null;
                candidateRun = 0;
            }

            const promote = candidate !== null && candidateRun >= onFrames;
            if (sounding !== null && (awayRun >= offFrames || promote)) {
                events.push({ kind: "off", note: sounding });
                sounding = null;
                awayRun = 0;
            }
            if (sounding === null && promote && candidate !== null) {
                events.push({ kind: "on", note: candidate });
                sounding = candidate;
                candidate = null;
                candidateRun = 0;
            }
            return events;
        },
        // Whatever is still sounding when the microphone stops.
        flush(): PitchEvent[] {
            if (sounding === null) {
                return [];
            }
            const off: PitchEvent = { kind: "off", note: sounding };
            sounding = null;
            candidate = null;
            candidateRun = 0;
            awayRun = 0;
            return [off];
        },
    };
}
