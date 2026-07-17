// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    CHORD_LEVELS,
    DEFAULT_HIGHEST,
    DEFAULT_LOWEST,
    type IntervalDirection,
    generateChord,
    generateInterval,
    generatePerfectPitch,
    generateQuestion,
    generateScale,
    INTERVAL_LEVELS,
    isCorrect,
    SCALE_LEVELS,
    scoreRounds,
} from "./earExercise";
import {
    chordPitches,
    INTERVAL_IDS,
    NATURAL_PITCH_CLASSES,
    noteNameOf,
    pitchClassOf,
    scalePitches,
    semitonesOf,
} from "./theory";

// The generators take an rng, so a fast-check float stream drives them exactly as
// Math.random would — every question in these properties is one a player could be asked.
const rngOf = (values: number[]): (() => number) => {
    let index = 0;
    return () => values[index++ % values.length] ?? 0;
};

const rolls = fc.array(fc.double({ min: 0, max: 0.999, noNaN: true }), {
    minLength: 1,
    maxLength: 12,
});

const levels = fc.integer({ min: 0, max: INTERVAL_LEVELS.length - 1 });
const directions = fc.constantFrom<IntervalDirection>("ascending", "descending", "harmonic");

describe("interval question properties", () => {
    it("sounds two notes exactly the answer's distance apart", () => {
        fc.assert(
            fc.property(rolls, levels, directions, (values, level, direction) => {
                const question = generateInterval(
                    {
                        intervals: INTERVAL_LEVELS[level]!,
                        direction,
                        lowest: 55,
                        highest: 79,
                    },
                    rngOf(values),
                );
                const [first, second] = question.notes;
                expect(Math.abs(second!.note - first!.note)).toBe(semitonesOf(question.answer));
            }),
        );
    });

    it("keeps both notes inside the configured range", () => {
        fc.assert(
            fc.property(rolls, levels, directions, (values, level, direction) => {
                const question = generateInterval(
                    { intervals: INTERVAL_LEVELS[level]!, direction, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                for (const note of question.notes) {
                    expect(note.note).toBeGreaterThanOrEqual(55);
                    expect(note.note).toBeLessThanOrEqual(79);
                }
            }),
        );
    });

    it("always offers the answer among the choices", () => {
        fc.assert(
            fc.property(rolls, levels, directions, (values, level, direction) => {
                const question = generateInterval(
                    { intervals: INTERVAL_LEVELS[level]!, direction, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                expect(question.choices).toContain(question.answer);
                expect(isCorrect(question, question.answer)).toBe(true);
            }),
        );
    });

    it("sounds the notes together only when they are heard as a chord", () => {
        fc.assert(
            fc.property(rolls, levels, directions, (values, level, direction) => {
                const question = generateInterval(
                    { intervals: INTERVAL_LEVELS[level]!, direction, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                const [first, second] = question.notes;
                const together = first!.at === second!.at;
                expect(together).toBe(direction === "harmonic");
            }),
        );
    });

    it("descends only when asked to", () => {
        fc.assert(
            fc.property(rolls, levels, (values, level) => {
                const question = generateInterval(
                    {
                        intervals: INTERVAL_LEVELS[level]!,
                        direction: "descending",
                        lowest: 55,
                        highest: 79,
                    },
                    rngOf(values),
                );
                const [first, second] = question.notes;
                expect(second!.note).toBeLessThanOrEqual(first!.note);
            }),
        );
    });
});

describe("perfect-pitch question properties", () => {
    it("names the note it sounds", () => {
        fc.assert(
            fc.property(rolls, fc.boolean(), (values, naturalsOnly) => {
                const question = generatePerfectPitch(
                    { naturalsOnly, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                const [note] = question.notes;
                expect(question.choices).toContain(question.answer);
                // The answer names the pitch class that actually sounded, whatever
                // octave it landed in — the exercise asks for the note, not the register.
                expect(question.answer).toBe(noteNameOf(pitchClassOf(note!.note)));
                expect(question.notes).toHaveLength(1);
            }),
        );
    });

    it("stays on the white keys when asked to", () => {
        fc.assert(
            fc.property(rolls, (values) => {
                const question = generatePerfectPitch(
                    { naturalsOnly: true, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                const [note] = question.notes;
                expect(NATURAL_PITCH_CLASSES).toContain(pitchClassOf(note!.note));
                expect(question.choices).toHaveLength(NATURAL_PITCH_CLASSES.length);
            }),
        );
    });

    it("offers all twelve notes once the black keys are in", () => {
        fc.assert(
            fc.property(rolls, (values) => {
                const question = generatePerfectPitch(
                    { naturalsOnly: false, lowest: 55, highest: 79 },
                    rngOf(values),
                );
                expect(question.choices).toHaveLength(12);
            }),
        );
    });
});

describe("difficulty ladder properties", () => {
    it("never takes an interval away as the levels climb", () => {
        for (let level = 1; level < INTERVAL_LEVELS.length; level++) {
            for (const interval of INTERVAL_LEVELS[level - 1]!) {
                expect(INTERVAL_LEVELS[level]).toContain(interval);
            }
        }
    });

    it("offers only real intervals at every level", () => {
        for (const level of INTERVAL_LEVELS) {
            for (const interval of level) {
                expect(INTERVAL_IDS).toContain(interval);
            }
        }
    });
});

describe("scoreRounds properties", () => {
    it("keeps accuracy between none and all of them", () => {
        fc.assert(
            fc.property(fc.array(fc.boolean(), { maxLength: 50 }), (results) => {
                const score = scoreRounds(
                    results.map((correct) => ({ answer: "a", given: correct ? "a" : "b", correct })),
                );
                expect(score.accuracy).toBeGreaterThanOrEqual(0);
                expect(score.accuracy).toBeLessThanOrEqual(1);
                expect(score.asked).toBe(results.length);
                expect(score.correct).toBe(results.filter(Boolean).length);
            }),
        );
    });

    it("reads an empty session as nothing asked rather than a divide by zero", () => {
        expect(scoreRounds([])).toEqual({ asked: 0, correct: 0, accuracy: 0 });
    });
});

const chordLevels = fc.integer({ min: 0, max: CHORD_LEVELS.length - 1 });
const scaleLevels = fc.integer({ min: 0, max: SCALE_LEVELS.length - 1 });
const RANGE = { lowest: DEFAULT_LOWEST, highest: DEFAULT_HIGHEST };

describe("chord question properties", () => {
    it("sounds exactly the chord's notes, all at once", () => {
        fc.assert(
            fc.property(rolls, chordLevels, (values, level) => {
                const q = generateChord({ qualities: CHORD_LEVELS[level]!, ...RANGE }, rngOf(values));
                // Every note starts together — a chord is heard as one sound.
                expect(q.notes.every((note) => note.at === 0)).toBe(true);
                const root = Math.min(...q.notes.map((note) => note.note));
                expect(q.notes.map((note) => note.note).sort((a, b) => a - b)).toEqual(
                    chordPitches(root, q.answer),
                );
            }),
        );
    });

    it("keeps every note in range and always offers the answer", () => {
        fc.assert(
            fc.property(rolls, chordLevels, (values, level) => {
                const q = generateChord({ qualities: CHORD_LEVELS[level]!, ...RANGE }, rngOf(values));
                for (const note of q.notes) {
                    expect(note.note).toBeGreaterThanOrEqual(DEFAULT_LOWEST);
                    expect(note.note).toBeLessThanOrEqual(DEFAULT_HIGHEST);
                }
                expect(q.choices).toContain(q.answer);
                expect(isCorrect(q, q.answer)).toBe(true);
            }),
        );
    });
});

describe("scale question properties", () => {
    it("sounds the scale as a rising sequence closing on the octave", () => {
        fc.assert(
            fc.property(rolls, scaleLevels, (values, level) => {
                const q = generateScale({ scales: SCALE_LEVELS[level]!, ...RANGE }, rngOf(values));
                const tonic = q.notes[0]!.note;
                expect(q.notes.map((note) => note.note)).toEqual(scalePitches(tonic, q.answer));
                // Each note begins after the one before — a climbing line, not a chord.
                for (let i = 1; i < q.notes.length; i++) {
                    expect(q.notes[i]!.at).toBeGreaterThan(q.notes[i - 1]!.at);
                }
            }),
        );
    });

    it("keeps every note in range and always offers the answer", () => {
        fc.assert(
            fc.property(rolls, scaleLevels, (values, level) => {
                const q = generateScale({ scales: SCALE_LEVELS[level]!, ...RANGE }, rngOf(values));
                for (const note of q.notes) {
                    expect(note.note).toBeGreaterThanOrEqual(DEFAULT_LOWEST);
                    expect(note.note).toBeLessThanOrEqual(DEFAULT_HIGHEST);
                }
                expect(q.choices).toContain(q.answer);
            }),
        );
    });
});

describe("generateQuestion dispatch", () => {
    it("routes each exercise to a question of its own kind", () => {
        fc.assert(
            fc.property(rolls, (values) => {
                const rng = () => rngOf(values)();
                expect(generateQuestion("intervals", 0, rng).kind).toBe("intervals");
                expect(generateQuestion("perfect-pitch", 0, rng).kind).toBe("perfect-pitch");
                expect(generateQuestion("chords", 0, rng).kind).toBe("chords");
                expect(generateQuestion("scales", 0, rng).kind).toBe("scales");
            }),
        );
    });
});
