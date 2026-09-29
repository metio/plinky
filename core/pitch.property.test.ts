// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    frequencyToMidi,
    levelToVelocity,
    type MicCalibration,
    midiToFrequency,
    rms,
    SILENCE_RMS,
} from "./pitch";

// A calibration is the player's own two strikes plus the room's noise floor; only the
// two anchors matter here.
const calibrated = (softLevel: number, loudLevel: number): MicCalibration => ({
    noiseFloor: SILENCE_RMS,
    softLevel,
    loudLevel,
    octaveShift: 0,
});

// The arithmetic the microphone path is built on. The detector itself is judged by its
// own tests on real signals; what belongs here are the laws — a note converts to a pitch
// and back to itself, a louder strike never reads as softer, and silence is silent.

const arbNote = fc.integer({ min: 21, max: 108 });

describe("pitch and frequency", () => {
    it("comes back as the note it started as", () => {
        fc.assert(
            fc.property(arbNote, (note) => {
                expect(frequencyToMidi(midiToFrequency(note))).toBe(note);
            }),
        );
    });

    it("snaps anything within a quarter tone to the note the player meant", () => {
        fc.assert(
            fc.property(arbNote, fc.double({ min: -0.49, max: 0.49, noNaN: true }), (note, off) => {
                // Sharp or flat by less than half a semitone is still that note.
                const wobbly = midiToFrequency(note) * 2 ** (off / 12);

                expect(frequencyToMidi(wobbly)).toBe(note);
            }),
        );
    });

    it("rises with the note", () => {
        fc.assert(
            fc.property(arbNote, arbNote, (first, second) => {
                fc.pre(first < second);

                expect(midiToFrequency(first)).toBeLessThan(midiToFrequency(second));
            }),
        );
    });

    it("puts the octave at twice the frequency", () => {
        fc.assert(
            fc.property(fc.integer({ min: 21, max: 96 }), (note) => {
                expect(midiToFrequency(note + 12)).toBeCloseTo(midiToFrequency(note) * 2, 6);
            }),
        );
    });
});

describe("how loud a frame is", () => {
    it("never reads below nothing, and reads silence as silence", () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { maxLength: 64 }),
                (samples) => {
                    const level = rms(Float32Array.from(samples));

                    expect(level).toBeGreaterThanOrEqual(0);
                    expect(Number.isFinite(level)).toBe(true);
                },
            ),
        );
        expect(rms(new Float32Array(32))).toBe(0);
        expect(rms(new Float32Array(0))).toBe(0);
        expect(rms(new Float32Array(32))).toBeLessThan(SILENCE_RMS);
    });

    it("reads a louder frame as louder", () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: -1, max: 1, noNaN: true }), {
                    minLength: 1,
                    maxLength: 32,
                }),
                fc.double({ min: 1.1, max: 4, noNaN: true }),
                (samples, gain) => {
                    const quiet = Float32Array.from(samples);
                    const loud = Float32Array.from(samples.map((sample) => sample * gain));
                    fc.pre(rms(quiet) > 0);

                    expect(rms(loud)).toBeGreaterThan(rms(quiet));
                },
            ),
        );
    });
});

describe("how hard a strike reads", () => {
    it("stays a velocity, and never drops as the strike gets louder", () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0.0001, max: 1, noNaN: true }),
                fc.double({ min: 1, max: 20, noNaN: true }),
                (level, gain) => {
                    const soft = levelToVelocity(level);
                    const louder = levelToVelocity(level * gain);

                    for (const velocity of [soft, louder]) {
                        expect(velocity).toBeGreaterThanOrEqual(1);
                        expect(velocity).toBeLessThanOrEqual(127);
                        expect(Number.isInteger(velocity)).toBe(true);
                    }
                    expect(louder).toBeGreaterThanOrEqual(soft);
                },
            ),
        );
    });

    it("anchors to the player's own soft and loud strikes", () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0.001, max: 0.05, noNaN: true }),
                fc.double({ min: 2, max: 20, noNaN: true }),
                (softLevel, spread) => {
                    const cal = calibrated(softLevel, softLevel * spread);

                    // At or below their soft strike is the floor; their loud strike is the
                    // ceiling; in between rises.
                    expect(levelToVelocity(softLevel, cal)).toBeLessThanOrEqual(
                        levelToVelocity(cal.loudLevel, cal),
                    );
                    expect(levelToVelocity(softLevel / 2, cal)).toBe(
                        levelToVelocity(softLevel, cal),
                    );
                },
            ),
        );
    });

    it("ignores a calibration whose anchors collapsed", () => {
        fc.assert(
            fc.property(fc.double({ min: 0.001, max: 1, noNaN: true }), (level) => {
                const collapsed = calibrated(level, level);

                expect(levelToVelocity(level, collapsed)).toBe(levelToVelocity(level));
            }),
        );
    });
});
