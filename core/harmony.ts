// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ChordQuality, chordPitches, type PitchClass, pitchClassOf } from "./theory";

// The chords a piece is built on, read off its notes.
//
// A player who reads a bar as "C, then G7" instead of nine separate notes reads faster,
// remembers more, and carries the shape to the next piece in the same key — and almost
// no score in the catalogue writes its chords down (eighty-seven of three thousand carry
// symbols). So the harmony is worked out here, from the page: for every beat, what is
// sounding, weighted by how long it sounds, matched against the chords the key offers,
// with a preference for staying on the chord already in force. Each answer carries how
// well it fit, so a surface can stay silent where the music is ambiguous rather than
// label a suspension as a wrong chord.
//
// Pure: notes with onsets and lengths in, spans out. Nothing here knows what a score
// looks like or how the result is shown.

export type HarmonyNote = {
    // Where it starts and how long it sounds, in whole notes.
    whole: number;
    wholes: number;
    // MIDI pitch, or null for a rest.
    midi: number | null;
};

export type HarmonyBar = { from: number; beats: number; beatType: number };
export type HarmonyKey = { whole: number; fifths: number };

export type Mode = "major" | "minor";

export type ChordSpan = {
    // Where the chord is in force, in whole notes; `to` exclusive.
    from: number;
    to: number;
    root: PitchClass;
    quality: ChordQuality;
    // The note underneath, and which chord tone it is: 0 root position, 1 first
    // inversion, and so on. A bass that is not a chord tone reads as root position.
    bass: PitchClass;
    inversion: number;
    // The chord's place in its key, as the ear hears it and as it carries between keys.
    numeral: string;
    key: { tonic: PitchClass; mode: Mode };
    // How much of what sounded belonged to the chord, 0 to 1. Below about 0.6 the reading
    // is a guess: a suspension, a chromatic run, two chords in one beat.
    confidence: number;
};

// A chord the key offers, with its numeral.
type Candidate = { step: number; quality: ChordQuality; numeral: string };

// What each mode offers: the diatonic triads and sevenths, and for the minor the
// dominant borrowed from the harmonic minor, which is the one nearly every minor piece
// actually uses. Kept to what a teaching piece is built of; a chord outside the set is
// read as the nearest one in it, at a lower confidence.
const MAJOR: Candidate[] = [
    { step: 0, quality: "major", numeral: "I" },
    { step: 2, quality: "minor", numeral: "ii" },
    { step: 4, quality: "minor", numeral: "iii" },
    { step: 5, quality: "major", numeral: "IV" },
    { step: 7, quality: "major", numeral: "V" },
    { step: 9, quality: "minor", numeral: "vi" },
    { step: 11, quality: "diminished", numeral: "vii°" },
    { step: 7, quality: "dominant-seventh", numeral: "V7" },
    { step: 0, quality: "major-seventh", numeral: "IΔ7" },
    { step: 2, quality: "minor-seventh", numeral: "ii7" },
    { step: 4, quality: "minor-seventh", numeral: "iii7" },
    { step: 5, quality: "major-seventh", numeral: "IVΔ7" },
    { step: 9, quality: "minor-seventh", numeral: "vi7" },
    { step: 11, quality: "half-diminished-seventh", numeral: "viiø7" },
];
const MINOR: Candidate[] = [
    { step: 0, quality: "minor", numeral: "i" },
    { step: 2, quality: "diminished", numeral: "ii°" },
    { step: 3, quality: "major", numeral: "III" },
    { step: 5, quality: "minor", numeral: "iv" },
    { step: 7, quality: "major", numeral: "V" },
    { step: 7, quality: "minor", numeral: "v" },
    { step: 8, quality: "major", numeral: "VI" },
    { step: 10, quality: "major", numeral: "VII" },
    { step: 11, quality: "diminished", numeral: "vii°" },
    { step: 7, quality: "dominant-seventh", numeral: "V7" },
    { step: 0, quality: "minor-seventh", numeral: "i7" },
    { step: 2, quality: "half-diminished-seventh", numeral: "iiø7" },
    { step: 5, quality: "minor-seventh", numeral: "iv7" },
    { step: 11, quality: "diminished-seventh", numeral: "vii°7" },
];

// How the pieces of a beat's evidence are weighed against each other, as shares of the
// beat's total sounding weight. A tone outside the chord costs as much as one inside it
// earns; the bass being a chord tone is worth a quarter of the beat, because a bass note
// is the one a listener hears the chord by; and the chord already in force keeps a
// small edge, so one passing beat does not flip the label back and forth.
const BASS_SHARE = 0.25;
// …and a bass that is the ROOT a little more still: two notes fit two chords, and B over
// D is B minor to a musician, not G major with its root missing.
const ROOT_SHARE = 0.1;
const STAY_SHARE = 0.15;
const RELATIVE_MINOR = 9;
const FIFTH = 7;

type Beat = {
    from: number;
    to: number;
    weights: Map<PitchClass, number>;
    total: number;
    bass: PitchClass | null;
};

// The beats of the piece, each with the weight of every pitch class sounding in it.
// A note that started before the beat and is still sounding counts for as long as it
// overlaps — an Alberti bass spreads its chord over the beat, and a held bass note under
// a run is the harmony of every beat it lasts through.
function beatsOf(notes: readonly HarmonyNote[], bars: readonly HarmonyBar[], end: number): Beat[] {
    const beats: Beat[] = [];
    for (const [index, bar] of bars.entries()) {
        const barEnd = bars[index + 1]?.from ?? Math.max(end, bar.from + bar.beats / bar.beatType);
        // Compound metres beat in threes: six-eight is two beats, not six.
        const grouped = bar.beats % 3 === 0 && bar.beats > 3 ? 3 : 1;
        const beatLength = grouped / bar.beatType;
        for (let from = bar.from; from < barEnd - EPSILON; from += beatLength) {
            beats.push({
                from,
                to: Math.min(from + beatLength, barEnd),
                weights: new Map(),
                total: 0,
                bass: null,
            });
        }
    }
    for (const note of notes) {
        if (note.midi === null || note.wholes <= 0) {
            continue;
        }
        const noteEnd = note.whole + note.wholes;
        for (const beat of beats) {
            if (beat.to <= note.whole + EPSILON) {
                continue;
            }
            if (beat.from >= noteEnd - EPSILON) {
                break;
            }
            const overlap = Math.min(beat.to, noteEnd) - Math.max(beat.from, note.whole);
            if (overlap <= 0) {
                continue;
            }
            const pitchClass = pitchClassOf(note.midi);
            beat.weights.set(pitchClass, (beat.weights.get(pitchClass) ?? 0) + overlap);
            beat.total += overlap;
        }
    }
    // The bass is the lowest note sounding as the beat begins — the one the ear takes
    // the chord from — or, on a beat that opens with silence, the lowest sounding in it.
    for (const beat of beats) {
        let lowest: HarmonyNote | null = null;
        let lowestAtStart: HarmonyNote | null = null;
        for (const note of notes) {
            if (note.midi === null || note.wholes <= 0 || note.whole >= beat.to - EPSILON) {
                continue;
            }
            if (note.whole + note.wholes <= beat.from + EPSILON) {
                continue;
            }
            if (lowest === null || note.midi < (lowest.midi as number)) {
                lowest = note;
            }
            if (
                note.whole <= beat.from + EPSILON &&
                (lowestAtStart === null || note.midi < (lowestAtStart.midi as number))
            ) {
                lowestAtStart = note;
            }
        }
        const bass = lowestAtStart ?? lowest;
        beat.bass = bass === null ? null : pitchClassOf(bass.midi as number);
    }
    return beats;
}

const EPSILON = 1e-6;

type Fit = { candidate: Candidate; root: PitchClass; score: number; confidence: number };

// How well a chord accounts for a beat: what it covers less what it leaves out, as a
// share of everything that sounded.
function fitOf(beat: Beat, tonic: PitchClass, candidate: Candidate, previous: Fit | null): Fit {
    const root = pitchClassOf(tonic + candidate.step);
    const tones = new Set(chordPitches(root, candidate.quality).map(pitchClassOf));
    let inside = 0;
    for (const [pitchClass, weight] of beat.weights) {
        inside += tones.has(pitchClass) ? weight : -weight;
    }
    const confidence = beat.total > 0 ? Math.max(0, inside / beat.total) : 0;
    let score = inside;
    if (beat.bass !== null && tones.has(beat.bass)) {
        score += BASS_SHARE * beat.total;
        if (beat.bass === root) {
            score += ROOT_SHARE * beat.total;
        }
    }
    if (
        previous !== null &&
        previous.root === root &&
        previous.candidate.quality === candidate.quality
    ) {
        score += STAY_SHARE * beat.total;
    }
    return { candidate, root, score, confidence };
}

function bestFit(beat: Beat, tonic: PitchClass, mode: Mode, previous: Fit | null): Fit | null {
    let best: Fit | null = null;
    for (const candidate of mode === "major" ? MAJOR : MINOR) {
        const fit = fitOf(beat, tonic, candidate, previous);
        if (best === null || fit.score > best.score) {
            best = fit;
        }
    }
    return best;
}

// The key signature says the tonic up to its relative minor; the music says which. The
// mode whose chords account for more of the notes wins, with the tonic chord of each
// weighed double: a piece in A minor spends its time on A minor and E major, and those
// are the chords C major would have to read as vi and III.
function modeOf(beats: readonly Beat[], tonic: PitchClass): Mode {
    let major = 0;
    let minor = 0;
    let previousMajor: Fit | null = null;
    let previousMinor: Fit | null = null;
    for (const beat of beats) {
        if (beat.total === 0) {
            continue;
        }
        const asMajor = bestFit(beat, tonic, "major", previousMajor);
        const asMinor = bestFit(beat, pitchClassOf(tonic + RELATIVE_MINOR), "minor", previousMinor);
        if (asMajor) {
            major += asMajor.confidence * (asMajor.candidate.step === 0 ? 2 : 1);
            previousMajor = asMajor;
        }
        if (asMinor) {
            minor += asMinor.confidence * (asMinor.candidate.step === 0 ? 2 : 1);
            previousMinor = asMinor;
        }
    }
    return minor > major ? "minor" : "major";
}

// The key in force at a point: the last signature at or before it, the opening one
// where the score writes none.
function fifthsAt(keys: readonly HarmonyKey[], whole: number): number {
    let fifths = keys[0]?.fifths ?? 0;
    for (const key of keys) {
        if (key.whole <= whole + EPSILON) {
            fifths = key.fifths;
        }
    }
    return fifths;
}

// Read the chords of a piece: one span per stretch of beats that agree on a chord.
export function readHarmony(timeline: {
    notes: readonly HarmonyNote[];
    bars: readonly HarmonyBar[];
    keys: readonly HarmonyKey[];
    end: number;
}): ChordSpan[] {
    const beats = beatsOf(timeline.notes, timeline.bars, timeline.end);
    // The mode is decided once per key signature, over every beat under it.
    const modes = new Map<number, Mode>();
    for (const fifths of new Set(beats.map((beat) => fifthsAt(timeline.keys, beat.from)))) {
        const under = beats.filter((beat) => fifthsAt(timeline.keys, beat.from) === fifths);
        modes.set(fifths, modeOf(under, pitchClassOf(fifths * FIFTH)));
    }
    const spans: (ChordSpan & { weight: number })[] = [];
    let previous: Fit | null = null;
    let open: (ChordSpan & { weight: number }) | null = null;
    for (const beat of beats) {
        if (beat.total === 0) {
            continue;
        }
        const fifths = fifthsAt(timeline.keys, beat.from);
        const mode = modes.get(fifths) ?? "major";
        const majorTonic = pitchClassOf(fifths * FIFTH);
        const tonic = mode === "major" ? majorTonic : pitchClassOf(majorTonic + RELATIVE_MINOR);
        const fit = bestFit(beat, tonic, mode, previous);
        if (fit === null) {
            continue;
        }
        previous = fit;
        const sameChord =
            open !== null &&
            open.root === fit.root &&
            open.quality === fit.candidate.quality &&
            Math.abs(open.to - beat.from) < EPSILON;
        if (sameChord && open !== null) {
            const weight = open.weight + beat.total;
            open.confidence =
                (open.confidence * open.weight + fit.confidence * beat.total) / weight;
            open.weight = weight;
            open.to = beat.to;
            continue;
        }
        const tones = chordPitches(fit.root, fit.candidate.quality).map(pitchClassOf);
        const bass = beat.bass ?? fit.root;
        const inversion = Math.max(0, tones.indexOf(bass));
        open = {
            from: beat.from,
            to: beat.to,
            root: fit.root,
            quality: fit.candidate.quality,
            bass,
            inversion,
            numeral: fit.candidate.numeral,
            key: { tonic, mode },
            confidence: fit.confidence,
            weight: beat.total,
        };
        spans.push(open);
    }
    return spans.map(({ weight: _weight, ...span }) => span);
}
