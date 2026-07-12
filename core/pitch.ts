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

// ---------------------------------------------------------------------------
// Chords: one autocorrelation pass seeds the strongest note, then the frame's
// magnitude spectrum is searched for further fundamentals whose harmonic
// stacks carry real energy of their own. Conservative on purpose: a phantom
// extra note is worse than a missed chord tone, so a candidate must score a
// solid fraction of the strongest note's energy to count.

// In-place iterative radix-2 FFT over a power-of-two frame; returns the
// magnitude spectrum's lower half. Hann-windowed so a piano tone's partials
// stand out as clean peaks instead of smearing.
export function magnitudeSpectrum(frame: Float32Array): Float32Array {
    const n = frame.length;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
        real[i] = frame[i]! * hann;
    }
    // Bit-reversal permutation.
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            const swap = real[i]!;
            real[i] = real[j]!;
            real[j] = swap;
        }
    }
    for (let length = 2; length <= n; length <<= 1) {
        const angle = (-2 * Math.PI) / length;
        for (let i = 0; i < n; i += length) {
            for (let k = 0; k < length / 2; k++) {
                const cos = Math.cos(angle * k);
                const sin = Math.sin(angle * k);
                const evenIndex = i + k;
                const oddIndex = i + k + length / 2;
                const oddReal = real[oddIndex]! * cos - imag[oddIndex]! * sin;
                const oddImag = real[oddIndex]! * sin + imag[oddIndex]! * cos;
                real[oddIndex] = real[evenIndex]! - oddReal;
                imag[oddIndex] = imag[evenIndex]! - oddImag;
                real[evenIndex] = real[evenIndex]! + oddReal;
                imag[evenIndex] = imag[evenIndex]! + oddImag;
            }
        }
    }
    const half = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
        half[i] = Math.hypot(real[i]!, imag[i]!);
    }
    return half;
}

const LOWEST_NOTE = 33; // A1
const HIGHEST_NOTE = 105; // A7
const HARMONICS = 5;

// A candidate fundamental's reading of the spectrum: the discounted energy of
// its first harmonics, the peak at the fundamental itself, and the stack's
// loudest peak — enough to score it and to reject octave ghosts.
function readStack(
    spectrum: Float32Array,
    binWidth: number,
    freq: number,
): { score: number; fundamental: number; loudest: number } {
    let score = 0;
    let fundamental = 0;
    let loudest = 0;
    for (let h = 1; h <= HARMONICS; h++) {
        const index = Math.round((freq * h) / binWidth);
        if (index < 1 || index >= spectrum.length - 1) {
            break;
        }
        const peak = Math.max(spectrum[index - 1]!, spectrum[index]!, spectrum[index + 1]!);
        score += peak / h;
        if (h === 1) {
            fundamental = peak;
        }
        loudest = Math.max(loudest, peak);
    }
    return { score, fundamental, loudest };
}

// Zero the bins around every harmonic of `freq`, so an already-claimed note's
// energy can't also elect its own overtones (an octave or a twelfth up).
function subtractHarmonics(spectrum: Float32Array, binWidth: number, freq: number): void {
    for (let h = 1; h <= HARMONICS + 2; h++) {
        const center = Math.round((freq * h) / binWidth);
        const width = Math.max(2, Math.round(center * 0.03));
        for (
            let i = Math.max(0, center - width);
            i <= Math.min(spectrum.length - 1, center + width);
            i++
        ) {
            spectrum[i] = 0;
        }
    }
}

// A further note must carry at least this fraction of the strongest note's
// score — conservative on purpose: a phantom extra note is worse than a
// missed chord tone.
const CHORD_THRESHOLD = 0.5;
// A real note's fundamental peak can't be a whisper next to its own loudest
// harmonic — an octave-low ghost has a near-empty fundamental bin and dies here.
const FUNDAMENTAL_SHARE = 0.2;

// The MIDI notes sounding together in `frame`, strongest first, at most
// `maxNotes`. The autocorrelation detector gates silence and noise (it is the
// robust judge of "is anything periodic sounding at all"); the notes themselves
// are elected from the spectrum, each claimed note's harmonics removed before
// the next round so overtones can't stand for their own.
export function detectPitches(frame: Float32Array, sampleRate: number, maxNotes = 3): number[] {
    if (detectPitch(frame, sampleRate) === null) {
        return [];
    }
    const spectrum = magnitudeSpectrum(frame);
    const binWidth = sampleRate / frame.length;
    const notes: number[] = [];
    let baseline = 0;

    while (notes.length < maxNotes) {
        let bestNote = -1;
        let bestScore = 0;
        for (let note = LOWEST_NOTE; note <= HIGHEST_NOTE; note++) {
            if (notes.some((chosen) => Math.abs(chosen - note) <= 1)) {
                continue;
            }
            const stack = readStack(spectrum, binWidth, midiToFrequency(note));
            if (stack.fundamental < stack.loudest * FUNDAMENTAL_SHARE) {
                continue;
            }
            if (stack.score > bestScore) {
                bestScore = stack.score;
                bestNote = note;
            }
        }
        if (bestNote < 0 || (baseline > 0 && bestScore < baseline * CHORD_THRESHOLD)) {
            break;
        }
        if (baseline === 0) {
            baseline = bestScore;
        }
        notes.push(bestNote);
        subtractHarmonics(spectrum, binWidth, midiToFrequency(bestNote));
    }
    return notes;
}

export type PitchEvent = {
    kind: "on" | "off";
    note: number;
    // How hard the note reads as struck, MIDI velocity range — only on "on"
    // events, derived from the frame loudness while the note established itself.
    velocity?: number;
};

// Map a frame's RMS loudness onto MIDI velocity. Logarithmic like hearing, and
// deliberately compressed into a friendly band: a whisper still sounds like a
// note, a hammered chord doesn't clip — headroom over fidelity.
const VELOCITY_FLOOR = 35;
const VELOCITY_CEIL = 112;
export function levelToVelocity(level: number): number {
    if (level <= SILENCE_RMS) {
        return VELOCITY_FLOOR;
    }
    // ~0.01 RMS (just audible) → floor; ~0.35 (a hard strike near the mic) → ceiling.
    const span = Math.log10(0.35 / SILENCE_RMS);
    const position = Math.log10(level / SILENCE_RMS) / span;
    return Math.round(
        Math.min(VELOCITY_CEIL, Math.max(VELOCITY_FLOOR, VELOCITY_FLOOR + (VELOCITY_CEIL - VELOCITY_FLOOR) * position)),
    );
}

export type TrackerOptions = {
    // Consecutive frames a note must appear before it sounds. Low enough to
    // feel immediate at ~60 frames a second, high enough that a transient
    // can't fire a phantom note.
    onFrames?: number;
    // Consecutive frames a sounding note must be absent before it releases.
    // Generous, so one dropped frame mid-sustain doesn't stutter the note off.
    offFrames?: number;
    // Most notes sounding at once — matches what the detector can honestly
    // tell apart, so the tracker can't pile up phantom voices.
    maxNotes?: number;
};

// Folds a per-frame detection stream — now a chord's worth of notes per frame —
// into note events with independent per-note hysteresis: each note earns its
// way in over `onFrames` and lingers `offFrames` after it vanishes, so chords
// don't have to land or lift perfectly together (nobody's do).
export function createNoteTracker(options: TrackerOptions = {}) {
    const onFrames = options.onFrames ?? 3;
    const offFrames = options.offFrames ?? 6;
    const maxNotes = options.maxNotes ?? 3;
    // note → frames seen in a row (and the loudest of them) while auditioning.
    const candidates = new Map<number, { run: number; peak: number }>();
    // note → frames missed in a row while sounding.
    const sounding = new Map<number, number>();

    return {
        // Feed one frame's detected notes (empty for silence/noise) with the
        // frame's loudness; collect the events the frame settles into.
        track(notes: readonly number[], level = 0): PitchEvent[] {
            const events: PitchEvent[] = [];
            const present = new Set(notes);

            for (const [note, missed] of sounding) {
                if (present.has(note)) {
                    sounding.set(note, 0);
                } else if (missed + 1 >= offFrames) {
                    sounding.delete(note);
                    events.push({ kind: "off", note });
                } else {
                    sounding.set(note, missed + 1);
                }
            }

            for (const note of candidates.keys()) {
                if (!present.has(note)) {
                    candidates.delete(note);
                }
            }
            for (const note of present) {
                if (sounding.has(note)) {
                    continue;
                }
                const audition = candidates.get(note) ?? { run: 0, peak: 0 };
                audition.run += 1;
                audition.peak = Math.max(audition.peak, level);
                candidates.set(note, audition);
                if (audition.run >= onFrames && sounding.size < maxNotes) {
                    candidates.delete(note);
                    sounding.set(note, 0);
                    events.push({ kind: "on", note, velocity: levelToVelocity(audition.peak) });
                }
            }
            return events;
        },
        // Whatever is still sounding when the microphone stops.
        flush(): PitchEvent[] {
            const events: PitchEvent[] = [...sounding.keys()].map((note) => ({
                kind: "off" as const,
                note,
            }));
            sounding.clear();
            candidates.clear();
            return events;
        },
    };
}
