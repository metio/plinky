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
    CHROMATIC_DEGREES,
    degreeNote,
    degreePitches,
    DIATONIC_DEGREES,
    type IntervalId,
    INTERVAL_IDS,
    type NoteNameId,
    NATURAL_PITCH_CLASSES,
    noteNameOf,
    pitchClassOf,
    type ScaleDegree,
    type ScaleId,
    scalePitches,
    SEMITONES_PER_OCTAVE,
    TRIAD_DEGREES,
} from "./theory";

export type EarExerciseId =
    | "perfect-pitch"
    | "intervals"
    | "chords"
    | "scales"
    | "progressions"
    | "scale-degrees"
    | "intervals-context"
    | "melodic-dictation";

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

// Scale degrees climb from the tonic triad a beginner tells apart, through the whole major
// scale, out to the chromatic notes between.
export const SCALE_DEGREE_LEVELS: ScaleDegree[][] = [
    TRIAD_DEGREES,
    DIATONIC_DEGREES,
    CHROMATIC_DEGREES,
];

export type ScaleDegreeConfig = { degrees: ScaleDegree[] };

// Intervals in context reuse the interval ladder — the level sets are the same — but the
// notes arrive after a cadence, so the ear places them in a key.
export type IntervalContextConfig = { intervals: IntervalId[] };

// Melodic dictation lengthens the line to hear: three notes, then four, then five.
export const MELODIC_LEVELS: number[] = [3, 4, 5];

export type MelodicConfig = { length: number };

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

// After a key-setting cadence, one note to name by its degree.
export type ScaleDegreeQuestion = {
    kind: "scale-degrees";
    notes: EarNote[];
    answer: ScaleDegree;
    choices: ScaleDegree[];
};

// After a cadence, two notes to name the interval between — intervals heard in a key.
export type IntervalContextQuestion = {
    kind: "intervals-context";
    notes: EarNote[];
    answer: IntervalId;
    choices: IntervalId[];
};

// After a cadence, a melody to write down degree by degree — a sequence answer like the
// chord progression, carrying the joined answer alongside its degrees.
export type MelodicQuestion = {
    kind: "melodic-dictation";
    notes: EarNote[];
    answer: string;
    sequence: ScaleDegree[];
    choices: ScaleDegree[];
};

export type EarQuestion =
    | PerfectPitchQuestion
    | IntervalQuestion
    | ChordQuestion
    | ScaleQuestion
    | ProgressionQuestion
    | ScaleDegreeQuestion
    | IntervalContextQuestion
    | MelodicQuestion;

// The gap between successive notes of a scale — quicker than a melodic interval, so the
// run reads as one shape rather than a string of separate notes.
const SCALE_STEP_GAP = 0.42;

// The gap between chords of a progression — slower than a scale's notes, since a whole
// chord needs a moment to land before the next one moves.
const PROGRESSION_CHORD_GAP = 1.1;

// The functional exercises hear notes relative to a key, so a low tonic leaves an octave
// of room above for the question notes while the key-setting cadence sits below.
const FUNCTIONAL_TONIC_LOW = 48; // C3
const FUNCTIONAL_TONIC_HIGH = 55; // G3
const MELODIC_NOTE_GAP = 0.55;
// The pause between the key-setting cadence and the question it frames.
const AFTER_CADENCE_GAP = 0.5;

function pickTonic(rng: () => number): number {
    const span = FUNCTIONAL_TONIC_HIGH - FUNCTIONAL_TONIC_LOW;
    return FUNCTIONAL_TONIC_LOW + Math.floor(rng() * (span + 1));
}

// A short I–IV–V–I cadence that plants a key in the ear before a functional question —
// the reference every "relative to the key" exercise leans on. It sounds a touch softer
// than the question, so the question stands out as the thing to name, and reports when it
// finishes so the question can follow.
const CADENCE_DEGREES: ChordDegree[] = ["I", "IV", "V", "I"];
const CADENCE_CHORD_GAP = 0.6;

function keyCadence(tonic: number, startAt: number): { notes: EarNote[]; endsAt: number } {
    const notes = CADENCE_DEGREES.flatMap((degree, index) =>
        degreePitches(tonic, degree).map((note) => ({
            note,
            at: startAt + index * CADENCE_CHORD_GAP,
            velocity: VELOCITY - 12,
            duration: CADENCE_CHORD_GAP,
        })),
    );
    return { notes, endsAt: startAt + CADENCE_DEGREES.length * CADENCE_CHORD_GAP };
}

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

export function generateScaleDegree(
    config: ScaleDegreeConfig,
    rng: () => number,
): ScaleDegreeQuestion {
    const degrees = config.degrees.length > 0 ? config.degrees : SCALE_DEGREE_LEVELS[0]!;
    const tonic = pickTonic(rng);
    const cadence = keyCadence(tonic, 0);
    const answer = pick(degrees, rng);
    const note: EarNote = {
        note: degreeNote(tonic, answer),
        at: cadence.endsAt + AFTER_CADENCE_GAP,
        velocity: VELOCITY,
        duration: NOTE_SECONDS,
    };
    return { kind: "scale-degrees", notes: [...cadence.notes, note], answer, choices: degrees };
}

export function generateIntervalContext(
    config: IntervalContextConfig,
    rng: () => number,
): IntervalContextQuestion {
    const intervals = config.intervals.length > 0 ? config.intervals : INTERVAL_LEVELS[0]!;
    const tonic = pickTonic(rng);
    const cadence = keyCadence(tonic, 0);
    const answer = pick(intervals, rng);
    const semitones = INTERVAL_IDS.indexOf(answer);
    // The pair sits an octave above the tonic, with room for the interval below the top of
    // the range — heard in sequence, rising, after the cadence.
    const base = tonic + SEMITONES_PER_OCTAVE;
    const room = Math.max(0, DEFAULT_HIGHEST - semitones - base);
    const root = base + Math.floor(rng() * (room + 1));
    const start = cadence.endsAt + AFTER_CADENCE_GAP;
    const notes: EarNote[] = [
        { note: root, at: start, velocity: VELOCITY, duration: NOTE_SECONDS },
        { note: root + semitones, at: start + MELODIC_GAP, velocity: VELOCITY, duration: NOTE_SECONDS },
    ];
    return { kind: "intervals-context", notes: [...cadence.notes, ...notes], answer, choices: intervals };
}

export function generateMelodic(config: MelodicConfig, rng: () => number): MelodicQuestion {
    const tonic = pickTonic(rng);
    const cadence = keyCadence(tonic, 0);
    // The line starts on the tonic to anchor the key, then moves by diatonic steps, never
    // repeating a note twice in a row.
    const sequence: ScaleDegree[] = ["1"];
    for (let position = 1; position < config.length; position++) {
        const previous = sequence[position - 1];
        const candidates = DIATONIC_DEGREES.filter((degree) => degree !== previous);
        sequence.push(pick(candidates, rng));
    }
    const start = cadence.endsAt + AFTER_CADENCE_GAP;
    const melody: EarNote[] = sequence.map((degree, index) => ({
        note: degreeNote(tonic, degree),
        at: start + index * MELODIC_NOTE_GAP,
        velocity: VELOCITY,
        duration: MELODIC_NOTE_GAP,
    }));
    return {
        kind: "melodic-dictation",
        notes: [...cadence.notes, ...melody],
        answer: sequence.join("-"),
        sequence,
        choices: DIATONIC_DEGREES,
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
        case "scale-degrees":
            return generateScaleDegree(
                { degrees: SCALE_DEGREE_LEVELS[level] ?? SCALE_DEGREE_LEVELS[0]! },
                rng,
            );
        case "intervals-context":
            return generateIntervalContext(
                { intervals: INTERVAL_LEVELS[level] ?? INTERVAL_LEVELS[0]! },
                rng,
            );
        case "melodic-dictation":
            return generateMelodic({ length: MELODIC_LEVELS[level] ?? MELODIC_LEVELS[0]! }, rng);
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
