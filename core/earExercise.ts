// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The ear exercises: a question is generated, sounded, and checked, and none of those
// three steps needs a score, a matcher or a rendered staff. That's why ear training
// lives beside the sight-reading loop rather than inside it.
//
// A question carries the notes to sound as data, so the same value drives the first
// playing and every replay, and a test can assert what was asked without hearing it.

import {
    type ChordDegree,
    type ChordQuality,
    chordPitches,
    chordSpan,
    degreePitches,
    type IntervalId,
    INTERVAL_IDS,
    type NoteNameId,
    NATURAL_PITCH_CLASSES,
    noteNameOf,
    pitchClassOf,
    type ScaleId,
    scalePitches,
    SEMITONES_PER_OCTAVE,
} from "./theory";

export type EarExerciseId =
    | "perfect-pitch"
    | "intervals"
    | "chords"
    | "scales"
    | "progressions";

// Matches the shape the audio port already strikes with: a note, when to sound it, how
// hard, and for how long. The engine needs no new audio capability.
export type EarNote = {
    note: number; // MIDI note
    at: number; // seconds from the start of the question
    velocity: number; // 0..127
    duration: number; // seconds
};

// A comfortable middle register: low enough to have body, high enough to stay clear,
// and centred on where a beginner's ear is already at home from playing.
export const DEFAULT_LOWEST = 55; // G3
export const DEFAULT_HIGHEST = 79; // G5

const VELOCITY = 82;
const NOTE_SECONDS = 0.9;
const MELODIC_GAP = 0.75; // the space between two notes heard in sequence

function pick<T>(items: readonly T[], rng: () => number): T {
    // The caller always passes a non-empty set; the fallback keeps the type honest
    // rather than asserting a value the compiler can't see.
    const index = Math.floor(rng() * items.length);
    return items[index] ?? items[0]!;
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

// Intervals are not equally hard to hear, and the ladder is pedagogy rather than
// arithmetic: the octave and perfect fifth are the ones a beginner picks out first,
// the thirds and sixths carry the major/minor colour that has to be learned, and the
// tritone and sevenths are the last to settle. Each level ADDS to the one before, so
// climbing never takes an interval away.
export const INTERVAL_LEVELS: IntervalId[][] = [
    ["unison", "octave", "perfect-fifth"],
    ["unison", "octave", "perfect-fifth", "perfect-fourth", "major-third", "minor-third"],
    [
        "unison",
        "octave",
        "perfect-fifth",
        "perfect-fourth",
        "major-third",
        "minor-third",
        "major-second",
        "minor-second",
        "major-sixth",
        "minor-sixth",
    ],
    [...INTERVAL_IDS],
];

export type IntervalDirection = "ascending" | "descending" | "harmonic";

export type IntervalConfig = {
    intervals: IntervalId[];
    // "mixed" is deliberately absent: a direction the player can't predict is a second
    // variable, so the caller picks one per round and the generator stays honest about
    // what it's testing.
    direction: IntervalDirection;
    lowest: number;
    highest: number;
};

export type PerfectPitchConfig = {
    naturalsOnly: boolean;
    lowest: number;
    highest: number;
};

// Chord qualities climb from the major/minor contrast a beginner hears first, out to the
// four triads, then the sevenths, then the lot. Each level keeps the ones before.
export const CHORD_LEVELS: ChordQuality[][] = [
    ["major", "minor"],
    ["major", "minor", "diminished", "augmented"],
    ["major", "minor", "diminished", "augmented", "dominant-seventh", "minor-seventh", "major-seventh"],
    [
        "major",
        "minor",
        "diminished",
        "augmented",
        "dominant-seventh",
        "minor-seventh",
        "major-seventh",
        "half-diminished-seventh",
        "diminished-seventh",
    ],
];

// Scales climb from the major/minor pair, through the minor variants, then the modes,
// then the colourful rest. Each level keeps the ones before.
export const SCALE_LEVELS: ScaleId[][] = [
    ["major", "natural-minor"],
    ["major", "natural-minor", "harmonic-minor", "melodic-minor"],
    ["major", "natural-minor", "harmonic-minor", "melodic-minor", "dorian", "phrygian", "lydian", "mixolydian"],
    [
        "major",
        "natural-minor",
        "harmonic-minor",
        "melodic-minor",
        "dorian",
        "phrygian",
        "lydian",
        "mixolydian",
        "major-pentatonic",
        "minor-pentatonic",
        "blues",
        "whole-tone",
        "chromatic",
    ],
];

export type ChordConfig = {
    qualities: ChordQuality[];
    lowest: number;
    highest: number;
};

export type ScaleConfig = {
    scales: ScaleId[];
    lowest: number;
    highest: number;
};

// Progressions climb by widening the vocabulary of chords they draw from: the three
// primary triads, then the pop four with vi, then every major-key triad, then all seven
// including the diminished vii°. Every level keeps the ones before, and every progression
// begins and ends on I, so the key is always audible however hard the middle gets.
export const PROGRESSION_LEVELS: ChordDegree[][] = [
    ["I", "IV", "V"],
    ["I", "IV", "V", "vi"],
    ["I", "ii", "iii", "IV", "V", "vi"],
    ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
];

// How many chords a progression holds — enough to make a phrase, short enough that naming
// every one stays within reach.
export const PROGRESSION_LENGTH = 4;

export type ProgressionConfig = {
    degrees: ChordDegree[];
    length: number;
    // The tonic register the progression is voiced around.
    lowest: number;
    highest: number;
};

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export type PerfectPitchQuestion = {
    kind: "perfect-pitch";
    notes: EarNote[];
    answer: NoteNameId;
    choices: NoteNameId[];
};

export type IntervalQuestion = {
    kind: "intervals";
    notes: EarNote[];
    answer: IntervalId;
    choices: IntervalId[];
    direction: IntervalDirection;
};

export type ChordQuestion = {
    kind: "chords";
    notes: EarNote[];
    answer: ChordQuality;
    choices: ChordQuality[];
};

export type ScaleQuestion = {
    kind: "scales";
    notes: EarNote[];
    answer: ScaleId;
    choices: ScaleId[];
};

export type ProgressionQuestion = {
    kind: "progressions";
    notes: EarNote[];
    // The joined degree sequence ("I-IV-V-I"), so the session's plain equality check and
    // its per-round record work unchanged; `sequence` carries the same answer chord by
    // chord for the surface's per-slot feedback.
    answer: string;
    sequence: ChordDegree[];
    choices: ChordDegree[];
};

export type EarQuestion =
    | PerfectPitchQuestion
    | IntervalQuestion
    | ChordQuestion
    | ScaleQuestion
    | ProgressionQuestion;

// The gap between successive notes of a scale — quicker than a melodic interval, so the
// run reads as one shape rather than a string of separate notes.
const SCALE_STEP_GAP = 0.42;

// The gap between chords of a progression — slower than a scale's notes, since a whole
// chord needs a moment to land before the next one moves.
const PROGRESSION_CHORD_GAP = 1.1;

// Every allowed answer is always offered. Narrowing the choices to a handful would make
// a round guessable by elimination, which grades the shortlist rather than the ear.
function candidateNotes(config: PerfectPitchConfig): number[] {
    const notes: number[] = [];
    for (let note = config.lowest; note <= config.highest; note++) {
        if (!config.naturalsOnly || NATURAL_PITCH_CLASSES.includes(pitchClassOf(note))) {
            notes.push(note);
        }
    }
    return notes;
}

export function generatePerfectPitch(
    config: PerfectPitchConfig,
    rng: () => number,
): PerfectPitchQuestion {
    const candidates = candidateNotes(config);
    const note = candidates.length > 0 ? pick(candidates, rng) : config.lowest;
    const choices = (
        config.naturalsOnly
            ? NATURAL_PITCH_CLASSES
            : Array.from({ length: SEMITONES_PER_OCTAVE }, (_, index) => index)
    ).map((pitchClass) => noteNameOf(pitchClass));
    return {
        kind: "perfect-pitch",
        notes: [{ note, at: 0, velocity: VELOCITY, duration: NOTE_SECONDS * 1.5 }],
        answer: noteNameOf(pitchClassOf(note)),
        choices,
    };
}

// The root is drawn from the range that leaves room for the interval in the chosen
// direction, so a descending minor second can't fall off the bottom of the keyboard.
function rootRange(config: IntervalConfig, semitones: number): [number, number] {
    if (config.direction === "descending") {
        return [config.lowest + semitones, config.highest];
    }
    return [config.lowest, config.highest - semitones];
}

export function generateInterval(config: IntervalConfig, rng: () => number): IntervalQuestion {
    const intervals = config.intervals.length > 0 ? config.intervals : INTERVAL_LEVELS[0]!;
    const answer = pick(intervals, rng);
    const semitones = INTERVAL_IDS.indexOf(answer);
    const [low, high] = rootRange(config, semitones);
    const span = Math.max(0, high - low);
    const root = low + Math.floor(rng() * (span + 1));
    const other = config.direction === "descending" ? root - semitones : root + semitones;

    // Heard together, the two notes start at once; heard in sequence, the second follows
    // the first after a gap that leaves the first note time to register.
    const together = config.direction === "harmonic";
    const notes: EarNote[] = [
        { note: root, at: 0, velocity: VELOCITY, duration: NOTE_SECONDS },
        {
            note: other,
            at: together ? 0 : MELODIC_GAP,
            velocity: VELOCITY,
            duration: NOTE_SECONDS,
        },
    ];

    return {
        kind: "intervals",
        notes,
        answer,
        choices: [...intervals],
        direction: config.direction,
    };
}

export function generateChord(config: ChordConfig, rng: () => number): ChordQuestion {
    const qualities = config.qualities.length > 0 ? config.qualities : CHORD_LEVELS[0]!;
    const answer = pick(qualities, rng);
    // The root leaves room for the chord's top note inside the range.
    const high = config.highest - chordSpan(answer);
    const span = Math.max(0, high - config.lowest);
    const root = config.lowest + Math.floor(rng() * (span + 1));
    // A chord is heard as one sound, so every note starts together and rings a while.
    const notes: EarNote[] = chordPitches(root, answer).map((note) => ({
        note,
        at: 0,
        velocity: VELOCITY,
        duration: NOTE_SECONDS * 1.8,
    }));
    return { kind: "chords", notes, answer, choices: [...qualities] };
}

export function generateScale(config: ScaleConfig, rng: () => number): ScaleQuestion {
    const scales = config.scales.length > 0 ? config.scales : SCALE_LEVELS[0]!;
    const answer = pick(scales, rng);
    // The tonic leaves room for the closing octave inside the range.
    const high = config.highest - SEMITONES_PER_OCTAVE;
    const span = Math.max(0, high - config.lowest);
    const tonic = config.lowest + Math.floor(rng() * (span + 1));
    // The scale climbs one note after another, each a step behind the last.
    const notes: EarNote[] = scalePitches(tonic, answer).map((note, index) => ({
        note,
        at: index * SCALE_STEP_GAP,
        velocity: VELOCITY,
        duration: SCALE_STEP_GAP,
    }));
    return { kind: "scales", notes, answer, choices: [...scales] };
}

export function generateProgression(
    config: ProgressionConfig,
    rng: () => number,
): ProgressionQuestion {
    const degrees = config.degrees.length > 0 ? config.degrees : PROGRESSION_LEVELS[0]!;
    // The tonic sits where every degree's triad fits the range: I's root is the lowest
    // note, and vii°'s stack the highest, seventeen semitones above the tonic.
    const high = config.highest - 17;
    const span = Math.max(0, high - config.lowest);
    const tonic = config.lowest + Math.floor(rng() * (span + 1));

    // Always I to I, so the key is heard at the start and resolved at the end; the middle
    // chords are drawn from the level's vocabulary, never repeating one twice in a row —
    // and the chord before the closing I is never itself I, so the resolution lands.
    const sequence: ChordDegree[] = ["I"];
    for (let position = 1; position < config.length - 1; position++) {
        const previous = sequence[position - 1];
        const beforeClose = position === config.length - 2;
        const candidates = degrees.filter(
            (degree) => degree !== previous && !(beforeClose && degree === "I"),
        );
        sequence.push(candidates.length > 0 ? pick(candidates, rng) : previous!);
    }
    sequence.push("I");

    // Each chord is a block, one after the next a beat apart.
    const notes: EarNote[] = sequence.flatMap((degree, index) =>
        degreePitches(tonic, degree).map((note) => ({
            note,
            at: index * PROGRESSION_CHORD_GAP,
            velocity: VELOCITY,
            duration: PROGRESSION_CHORD_GAP,
        })),
    );

    return {
        kind: "progressions",
        notes,
        answer: sequence.join("-"),
        sequence,
        choices: [...degrees],
    };
}

// The question for an exercise at a level, over the default register. The one place the
// exercise id maps to its generator and its level-set, so a caller names an exercise and
// a level and gets a playable question — the surface it drives falls out of the kind.
export function generateQuestion(
    exercise: EarExerciseId,
    level: number,
    rng: () => number,
): EarQuestion {
    const range = { lowest: DEFAULT_LOWEST, highest: DEFAULT_HIGHEST };
    switch (exercise) {
        case "perfect-pitch":
            return generatePerfectPitch({ naturalsOnly: true, ...range }, rng);
        case "chords":
            return generateChord({ qualities: CHORD_LEVELS[level] ?? CHORD_LEVELS[0]!, ...range }, rng);
        case "scales":
            return generateScale({ scales: SCALE_LEVELS[level] ?? SCALE_LEVELS[0]!, ...range }, rng);
        case "progressions":
            return generateProgression(
                {
                    degrees: PROGRESSION_LEVELS[level] ?? PROGRESSION_LEVELS[0]!,
                    length: PROGRESSION_LENGTH,
                    ...range,
                },
                rng,
            );
        default:
            return generateInterval(
                {
                    intervals: INTERVAL_LEVELS[level] ?? INTERVAL_LEVELS[0]!,
                    direction: "ascending",
                    ...range,
                },
                rng,
            );
    }
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

export function isCorrect(question: EarQuestion, given: string): boolean {
    return question.answer === given;
}

// ---------------------------------------------------------------------------
// Scoring a session
// ---------------------------------------------------------------------------

export type EarRound = {
    answer: string;
    given: string;
    correct: boolean;
};

export type EarScore = {
    asked: number;
    correct: number;
    accuracy: number; // 0..1
};

export function scoreRounds(rounds: readonly EarRound[]): EarScore {
    const correct = rounds.filter((round) => round.correct).length;
    return {
        asked: rounds.length,
        correct,
        accuracy: rounds.length === 0 ? 0 : correct / rounds.length,
    };
}
