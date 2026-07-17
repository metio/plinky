// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The ear exercises: a question is generated, sounded, and checked, and none of those
// three steps needs a score, a matcher or a rendered staff. That's why ear training
// lives beside the sight-reading loop rather than inside it.
//
// A question carries the notes to sound as data, so the same value drives the first
// playing and every replay, and a test can assert what was asked without hearing it.

import {
    type IntervalId,
    INTERVAL_IDS,
    type NoteNameId,
    NATURAL_PITCH_CLASSES,
    noteNameOf,
    pitchClassOf,
    SEMITONES_PER_OCTAVE,
} from "./theory";

export type EarExerciseId = "perfect-pitch" | "intervals";

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

export type EarQuestion = PerfectPitchQuestion | IntervalQuestion;

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
