// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    CHORD_DEGREES,
    CHORD_QUALITIES,
    chordLetterSteps,
    chordPitches,
    chordSpan,
    CHROMATIC_DEGREES,
    degreeNote,
    degreeOf,
    degreePitches,
    DIATONIC_DEGREES,
    INTERVAL_IDS,
    intervalIdOf,
    NATURAL_PITCH_CLASSES,
    NOTE_NAME_IDS,
    noteNameOf,
    pitchClassOf,
    SCALE_IDS,
    scalePitches,
    SEMITONES_PER_OCTAVE,
    semitonesOf,
    TRIAD_DEGREES,
} from "./theory";

// The music theory everything else is measured against: what a note is called, how far
// apart two notes are, which notes a chord or a scale holds. Every screen that teaches,
// generates or grades reads through here, so an error is wrong in the ear as well as on
// the page — and the laws are the ones music itself obeys. Transposition is the sharpest
// of them: a quality is what it sounds like whatever the root, so moving a chord or a
// scale bodily must move every note with it and change nothing else.

const arbMidi = fc.integer({ min: -48, max: 132 });
const arbPitchClass = fc.integer({ min: 0, max: 11 });
const arbRoot = fc.integer({ min: 21, max: 96 });
const rising = (notes: number[]) =>
    notes.every((note, at) => at === 0 || note > (notes[at - 1] as number));

describe("a note's pitch class", () => {
    it("names one of the twelve, however far the note is from middle C", () => {
        fc.assert(
            fc.property(arbMidi, (midi) => {
                const pitchClass = pitchClassOf(midi);

                expect(Number.isInteger(pitchClass)).toBe(true);
                expect(pitchClass).toBeGreaterThanOrEqual(0);
                expect(pitchClass).toBeLessThan(SEMITONES_PER_OCTAVE);
            }),
        );
    });

    it("hears the octave as the same note", () => {
        fc.assert(
            fc.property(arbMidi, fc.integer({ min: -4, max: 4 }), (midi, octaves) => {
                expect(pitchClassOf(midi + octaves * SEMITONES_PER_OCTAVE)).toBe(
                    pitchClassOf(midi),
                );
            }),
        );
    });
});

describe("what a note is called", () => {
    it("gives every pitch a name the app knows, in either spelling", () => {
        fc.assert(
            fc.property(
                arbMidi,
                fc.constantFrom("sharp" as const, "flat" as const),
                (midi, spelling) => {
                    const name = noteNameOf(pitchClassOf(midi), spelling);

                    expect(NOTE_NAME_IDS).toContain(name);
                    // The name is the pitch class's, so the octave cannot change it.
                    expect(noteNameOf(pitchClassOf(midi + SEMITONES_PER_OCTAVE), spelling)).toBe(
                        name,
                    );
                },
            ),
        );
    });

    it("spells a white key one way and a black key two", () => {
        fc.assert(
            fc.property(arbPitchClass, (pitchClass) => {
                const sharp = noteNameOf(pitchClass, "sharp");
                const flat = noteNameOf(pitchClass, "flat");

                if (NATURAL_PITCH_CLASSES.includes(pitchClass)) {
                    // A white key has one name: nothing to choose, so the spelling is moot.
                    expect(flat).toBe(sharp);
                    expect(sharp).not.toContain("-");
                } else {
                    // A black key is the same sound under two names, and which is right
                    // depends on the key — so they must differ, and each must say so.
                    expect(flat).not.toBe(sharp);
                    expect(sharp).toContain("-sharp");
                    expect(flat).toContain("-flat");
                }
            }),
        );
    });
});

describe("how far apart two notes are", () => {
    it("reads a distance back as the distance it is", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 12 }), (semitones) => {
                expect(semitonesOf(intervalIdOf(semitones))).toBe(semitones);
            }),
        );
        for (const interval of INTERVAL_IDS) {
            expect(intervalIdOf(semitonesOf(interval))).toBe(interval);
        }
    });

    it("hears a compound interval as the simple one inside it", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 11 }),
                fc.integer({ min: 1, max: 4 }),
                (semitones, octaves) => {
                    // A tenth is heard as a third: the ear names the simple interval.
                    expect(intervalIdOf(semitones + octaves * SEMITONES_PER_OCTAVE)).toBe(
                        intervalIdOf(semitones),
                    );
                },
            ),
        );
    });

    it("hears a stack of octaves as an octave, and no distance as none", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 6 }), (octaves) => {
                expect(intervalIdOf(octaves * SEMITONES_PER_OCTAVE)).toBe("octave");
            }),
        );
        expect(intervalIdOf(0)).toBe("unison");
    });

    it("measures a gap the same in either direction", () => {
        fc.assert(
            fc.property(arbMidi, arbMidi, (first, second) => {
                expect(intervalIdOf(first - second)).toBe(intervalIdOf(second - first));
            }),
        );
    });
});

describe("the notes of a chord", () => {
    const arbQuality = fc.constantFrom(...CHORD_QUALITIES);

    it("stands on its root and rises from there", () => {
        fc.assert(
            fc.property(arbRoot, arbQuality, (root, quality) => {
                const pitches = chordPitches(root, quality);

                expect(pitches[0]).toBe(root);
                expect(rising(pitches)).toBe(true);
                expect(pitches.length).toBe(chordLetterSteps(quality).length);
                // The span is the room a generator must leave above the root.
                expect(Math.max(...pitches) - root).toBe(chordSpan(quality));
            }),
        );
    });

    it("is the same chord wherever it is played from", () => {
        fc.assert(
            fc.property(
                arbRoot,
                arbQuality,
                fc.integer({ min: -24, max: 24 }),
                (root, quality, by) => {
                    // A quality is what it sounds like whatever the root: moving the chord
                    // moves every note with it and changes nothing else.
                    expect(chordPitches(root + by, quality)).toEqual(
                        chordPitches(root, quality).map((pitch) => pitch + by),
                    );
                    expect(chordSpan(quality)).toBe(chordSpan(quality));
                },
            ),
        );
    });

    it("sounds no note of the chord twice", () => {
        for (const quality of CHORD_QUALITIES) {
            const classes = chordPitches(60, quality).map(pitchClassOf);

            expect(new Set(classes).size).toBe(classes.length);
        }
    });

    it("writes each tone on its own letter, rising with the sound", () => {
        for (const quality of CHORD_QUALITIES) {
            const letters = chordLetterSteps(quality);

            expect(letters[0]).toBe(0);
            expect(rising([...letters])).toBe(true);
        }
    });
});

describe("the notes of a scale", () => {
    const arbScale = fc.constantFrom(...SCALE_IDS);

    it("starts on its tonic, rises, and closes on the octave", () => {
        fc.assert(
            fc.property(arbRoot, arbScale, (tonic, scale) => {
                const pitches = scalePitches(tonic, scale);

                expect(pitches[0]).toBe(tonic);
                expect(pitches[pitches.length - 1]).toBe(tonic + SEMITONES_PER_OCTAVE);
                expect(rising(pitches)).toBe(true);
                // The octave closes the run and appears nowhere inside it, so a scale
                // that stopped on its leading note cannot sound finished by accident.
                expect(
                    pitches.filter((pitch) => pitch === tonic + SEMITONES_PER_OCTAVE).length,
                ).toBe(1);
            }),
        );
    });

    it("is the same scale from any tonic", () => {
        fc.assert(
            fc.property(
                arbRoot,
                arbScale,
                fc.integer({ min: -24, max: 24 }),
                (tonic, scale, by) => {
                    expect(scalePitches(tonic + by, scale)).toEqual(
                        scalePitches(tonic, scale).map((pitch) => pitch + by),
                    );
                },
            ),
        );
    });
});

describe("the chords a key is built from", () => {
    it("builds every degree out of the notes of the key", () => {
        fc.assert(
            fc.property(arbRoot, fc.constantFrom(...CHORD_DEGREES), (tonic, degree) => {
                const inKey = new Set(scalePitches(tonic, "major").map(pitchClassOf));

                const triad = degreePitches(tonic, degree);

                expect(triad.length).toBe(3);
                expect(rising(triad)).toBe(true);
                for (const pitch of triad) {
                    // A diatonic triad borrows nothing: every note of it is in the key.
                    expect(inKey.has(pitchClassOf(pitch))).toBe(true);
                }
            }),
        );
    });

    it("gives the key seven different chords", () => {
        fc.assert(
            fc.property(arbRoot, (tonic) => {
                const roots = CHORD_DEGREES.map((degree) => degreePitches(tonic, degree)[0]);

                expect(new Set(roots).size).toBe(CHORD_DEGREES.length);
            }),
        );
    });
});

describe("a note's place in the key", () => {
    it("reads a degree's note back as that degree", () => {
        fc.assert(
            fc.property(arbRoot, fc.constantFrom(...CHROMATIC_DEGREES), (tonic, degree) => {
                expect(degreeOf(tonic, degreeNote(tonic, degree))).toBe(degree);
            }),
        );
    });

    it("sounds the degree above the cadence that set the key", () => {
        fc.assert(
            fc.property(arbRoot, fc.constantFrom(...CHROMATIC_DEGREES), (tonic, degree) => {
                const note = degreeNote(tonic, degree);

                expect(note).toBeGreaterThanOrEqual(tonic + SEMITONES_PER_OCTAVE);
                expect(note).toBeLessThan(tonic + 2 * SEMITONES_PER_OCTAVE);
            }),
        );
    });

    it("names the same degree in every octave", () => {
        fc.assert(
            fc.property(
                arbRoot,
                arbMidi,
                fc.integer({ min: -3, max: 3 }),
                (tonic, note, octaves) => {
                    expect(degreeOf(tonic, note + octaves * SEMITONES_PER_OCTAVE)).toBe(
                        degreeOf(tonic, note),
                    );
                },
            ),
        );
    });

    it("keeps the teaching sets inside the full one", () => {
        expect(CHROMATIC_DEGREES.length).toBe(SEMITONES_PER_OCTAVE);
        expect(new Set(CHROMATIC_DEGREES).size).toBe(CHROMATIC_DEGREES.length);
        for (const degree of [...DIATONIC_DEGREES, ...TRIAD_DEGREES]) {
            expect(CHROMATIC_DEGREES).toContain(degree);
        }
        // The tonic triad is where a beginner starts, so it must be inside the scale
        // they are shown first.
        for (const degree of TRIAD_DEGREES) {
            expect(DIATONIC_DEGREES).toContain(degree);
        }
    });
});
