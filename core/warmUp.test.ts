// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { buildExerciseId, exerciseTitle, keyName, keySlugFor } from "./exerciseGen";
import { warmUpFor } from "./warmUp";

describe("keySlugFor", () => {
    it("reads a written key signature the way an exercise names it", () => {
        // A score says "three flats"; the exercise generator says "eflat". Same fact, two
        // vocabularies, and this is the only place they meet.
        expect(keySlugFor(-3, false)).toBe("eflat");
        expect(keySlugFor(0, false)).toBe("c");
        expect(keySlugFor(2, false)).toBe("d");
    });

    it("reads the same signature differently for a minor piece", () => {
        // No sharps and no flats is C major or A minor, and answering a minor piece with
        // the C scale would name the wrong tonic.
        expect(keySlugFor(0, true)).toBe("a");
        expect(keySlugFor(1, true)).toBe("e");
    });

    it("has no answer outside the keys the exercises ship", () => {
        expect(keySlugFor(6, false)).toBeNull();
        expect(keySlugFor(-7, true)).toBeNull();
    });
});

describe("warmUpFor", () => {
    it("offers the piece's own scale, and counts what the hand has to place", () => {
        const warm = warmUpFor({ fifths: -3, minor: false, isExercise: false });
        expect(warm).not.toBeNull();
        expect(warm?.key).toBe("eflat");
        expect(warm?.accidentals).toBe(3);
        expect(warm?.exercise.type).toBe("major-scale");
    });

    it("counts flats as a count, not as a negative number", () => {
        // The sentence says "three flats". A signature of -3 rendered raw would say
        // "-3 flats", which is the kind of thing that ships.
        expect(warmUpFor({ fifths: -5, minor: false, isExercise: false })?.accidentals).toBe(5);
        expect(warmUpFor({ fifths: 5, minor: false, isExercise: false })?.accidentals).toBe(5);
    });

    it("names the minor scale the signature actually writes", () => {
        // The piece may well use the harmonic form, but its raised seventh is an accidental
        // on the page rather than part of the key — so the printed signature is the natural
        // minor, and that is what the warm-up teaches.
        const warm = warmUpFor({ fifths: 0, minor: true, isExercise: false });
        expect(warm?.key).toBe("a");
        expect(warm?.exercise.type).toBe("natural-minor-scale");
    });

    it("says nothing before an exercise, which would be a scale before a scale", () => {
        expect(warmUpFor({ fifths: -3, minor: false, isExercise: true })).toBeNull();
    });

    it("says nothing rather than the wrong thing for a key it cannot name", () => {
        // Six sharps is a real signature the exercise set has no major scale for. Answering
        // it with a neighbouring key would teach the wrong accidentals.
        expect(warmUpFor({ fifths: 6, minor: false, isExercise: false })).toBeNull();
    });

    it("produces an exercise that is actually playable and nameable", () => {
        // The whole unit rests on this: the config has to survive the round trip into a
        // playable id and a human title, or the card offers a link to nothing.
        const warm = warmUpFor({ fifths: 2, minor: false, isExercise: false });
        expect(warm).not.toBeNull();
        const id = buildExerciseId(warm!.exercise);
        expect(id.length).toBeGreaterThan(0);
        expect(exerciseTitle(warm!.exercise)).toContain(keyName("d"));
    });
});
