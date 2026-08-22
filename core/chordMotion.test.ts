// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { commonTones, shortestStep, smoothestMotion } from "./chordMotion";
import { chordPitches } from "./theory";

const C = chordPitches(60, "major"); // C E G
const F = chordPitches(65, "major"); // F A C
const G = chordPitches(67, "major"); // G B D
const Am = chordPitches(69, "minor"); // A C E

describe("commonTones", () => {
    it("finds the note a hand can simply keep", () => {
        // C and F share C — the reason the change sits so easily under the fingers.
        expect(commonTones(C, F)).toEqual([0]);
    });

    it("finds two shared notes where there are two", () => {
        // C major and A minor share C and E, which is why the relative minor feels close.
        expect(commonTones(C, Am)).toEqual([0, 4]);
    });

    it("finds none where a change shares nothing", () => {
        // A semitone away shares nothing at all — which is exactly why it sounds so far.
        expect(commonTones(C, chordPitches(61, "major"))).toEqual([]);
    });

    it("counts the fifth two neighbouring chords share", () => {
        // C and G share G. It is one note rather than two, which is why the dominant
        // pulls where the relative minor settles.
        expect(commonTones(C, G)).toEqual([7]);
    });

    it("counts a note by its pitch class, not by where it is played", () => {
        // A C an octave up is the same note of the chord; the finger holding it does not
        // move either way.
        expect(commonTones([60, 64, 67], [72, 76, 79])).toEqual([0, 4, 7]);
    });
});

describe("shortestStep", () => {
    it("takes the near route round the octave", () => {
        // B to C is one semitone, not eleven.
        expect(shortestStep(71, 72)).toBe(1);
        expect(shortestStep(72, 71)).toBe(1);
    });

    it("is zero for the same note in another octave", () => {
        expect(shortestStep(60, 72)).toBe(0);
    });

    it("is at most a tritone, which is the far side of the circle", () => {
        expect(shortestStep(60, 66)).toBe(6);
        expect(shortestStep(60, 67)).toBe(5);
    });
});

describe("smoothestMotion", () => {
    it("keeps the shared note still and moves only what must move", () => {
        // C -> F: C stays, E steps up to F, G steps up to A. Two semitones of travel.
        const motion = smoothestMotion(C, F);
        expect(motion.common).toEqual([0]);
        expect(motion.distance).toBe(3);
        expect(motion.moves.find((move) => move.from === 0)?.semitones).toBe(0);
    });

    it("finds the pairing that moves least, not the one written in order", () => {
        // Paired root-to-root, C->G would be three leaps of a fifth. The ear takes the
        // near route instead: G stays put, and the other two step by one and by two.
        const motion = smoothestMotion(C, G);
        expect(motion.distance).toBeLessThan(7);
    });

    it("says a chord costs nothing to reach from itself", () => {
        expect(smoothestMotion(C, C).distance).toBe(0);
        expect(smoothestMotion(C, C).common).toEqual([0, 4, 7]);
    });

    it("compares two changes, which is the point of measuring at all", () => {
        // The relative minor is a smaller move than the dominant, which is what makes it
        // the gentler place to go.
        expect(smoothestMotion(C, Am).distance).toBeLessThan(smoothestMotion(C, G).distance);
    });

    it("treats a note added by a bigger chord as a finger put down, not moved", () => {
        // C major to C major seventh: the triad is already there, B is new.
        const motion = smoothestMotion(C, chordPitches(60, "major-seventh"));
        expect(motion.distance).toBe(0);
        expect(motion.common).toEqual([0, 4, 7]);
    });

    it("is symmetrical in distance, because a change costs the same either way", () => {
        for (const [one, other] of [
            [C, F],
            [C, G],
            [C, Am],
            [F, G],
        ]) {
            expect(smoothestMotion(one!, other!).distance).toBe(
                smoothestMotion(other!, one!).distance,
            );
        }
    });

    it("says nothing about an empty hand", () => {
        expect(smoothestMotion([], C)).toEqual({ common: [], moves: [], distance: 0 });
    });
});
