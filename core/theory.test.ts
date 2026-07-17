// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    CHORD_QUALITIES,
    chordPitches,
    chordSpan,
    INTERVAL_IDS,
    intervalIdOf,
    NATURAL_PITCH_CLASSES,
    noteNameOf,
    pitchClassOf,
    SCALE_IDS,
    scalePitches,
    semitonesOf,
} from "./theory";

describe("pitchClassOf", () => {
    it("maps middle C to 0", () => {
        expect(pitchClassOf(60)).toBe(0);
    });

    it("folds every octave onto the same class", () => {
        expect(pitchClassOf(69)).toBe(pitchClassOf(81));
    });

    it("stays in range for a negative note", () => {
        expect(pitchClassOf(-1)).toBe(11);
    });
});

describe("noteNameOf", () => {
    it("names the naturals without an accidental", () => {
        expect(noteNameOf(0)).toBe("c");
        expect(noteNameOf(11)).toBe("b");
    });

    it("spells a black key both ways", () => {
        expect(noteNameOf(1, "sharp")).toBe("c-sharp");
        expect(noteNameOf(1, "flat")).toBe("d-flat");
    });

    it("defaults to sharps", () => {
        expect(noteNameOf(6)).toBe("f-sharp");
    });

    it("agrees with the natural set on which classes are white keys", () => {
        for (const pitchClass of NATURAL_PITCH_CLASSES) {
            expect(noteNameOf(pitchClass)).not.toContain("-");
        }
    });
});

describe("intervalIdOf", () => {
    it("names each interval within the octave", () => {
        expect(intervalIdOf(0)).toBe("unison");
        expect(intervalIdOf(7)).toBe("perfect-fifth");
        expect(intervalIdOf(12)).toBe("octave");
    });

    it("hears a descending interval as the same size", () => {
        expect(intervalIdOf(-4)).toBe("major-third");
    });

    it("folds a compound interval onto its simple form", () => {
        expect(intervalIdOf(16)).toBe("major-third"); // a major tenth
        expect(intervalIdOf(19)).toBe("perfect-fifth"); // a twelfth
    });

    it("keeps a multiple of an octave an octave rather than a unison", () => {
        expect(intervalIdOf(24)).toBe("octave");
    });
});

describe("semitonesOf", () => {
    it("round-trips every interval through its size", () => {
        for (const interval of INTERVAL_IDS) {
            expect(intervalIdOf(semitonesOf(interval))).toBe(interval);
        }
    });
});

describe("chords", () => {
    it("stacks a major triad as root, major third, perfect fifth", () => {
        expect(chordPitches(60, "major")).toEqual([60, 64, 67]);
    });

    it("stacks a dominant seventh with its minor seventh on top", () => {
        expect(chordPitches(60, "dominant-seventh")).toEqual([60, 64, 67, 70]);
    });

    it("reports each quality's span as the reach of its top note", () => {
        expect(chordSpan("major")).toBe(7);
        expect(chordSpan("augmented")).toBe(8);
        expect(chordSpan("major-seventh")).toBe(11);
    });

    it("keeps every quality's notes ascending from the root", () => {
        for (const quality of CHORD_QUALITIES) {
            const pitches = chordPitches(60, quality);
            expect(pitches[0]).toBe(60);
            expect([...pitches].sort((a, b) => a - b)).toEqual(pitches);
        }
    });
});

describe("scales", () => {
    it("climbs a major scale and closes on the octave", () => {
        expect(scalePitches(60, "major")).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    });

    it("gives the chromatic scale all twelve steps plus the octave", () => {
        expect(scalePitches(60, "chromatic")).toHaveLength(13);
    });

    it("ascends and closes on the octave for every scale", () => {
        for (const scale of SCALE_IDS) {
            const pitches = scalePitches(60, scale);
            expect(pitches[0]).toBe(60);
            expect(pitches.at(-1)).toBe(72);
            expect([...pitches].sort((a, b) => a - b)).toEqual(pitches);
        }
    });
});
