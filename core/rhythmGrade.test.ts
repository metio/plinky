// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { gradeRhythm, rhythmVerdictRating } from "./rhythmGrade";
import { LENIENT_TOLERANCE } from "./rhythm";

const BEAT = 500;
const FOUR = [0, BEAT, 2 * BEAT, 3 * BEAT];

describe("grading a tapped rhythm", () => {
    it("calls a tap on every note perfect", () => {
        const verdict = gradeRhythm(FOUR, FOUR);
        expect(verdict).toMatchObject({ perfect: 4, good: 0, off: 0, missed: 0, extra: 0 });
        expect(rhythmVerdictRating(verdict)).toBe("perfect");
    });

    it("reports a note nobody tapped as missed, not as a note tapped badly", () => {
        const verdict = gradeRhythm(FOUR, [0, BEAT, 3 * BEAT]);
        expect(verdict).toMatchObject({ missed: 1, extra: 0 });
        expect(verdict.hits[2]).toBeNull();
        expect(verdict.hits[3]).not.toBeNull();
    });

    it("reports a tap near nothing as extra rather than blaming a note for it", () => {
        const verdict = gradeRhythm(FOUR, [...FOUR, 3 * BEAT + 480]);
        expect(verdict).toMatchObject({ perfect: 4, missed: 0, extra: 1 });
    });

    it("gives a tap to the note it was nearest, not to the first note that could claim it", () => {
        // The reason the matching is nearest-first rather than in written order. Walked in
        // order, note 1 claims the only tap because that tap is within reach of it — and
        // the tap is then reported as 180 ms out while note 2, which it plainly was, reads
        // as missed. Both notes end up described wrongly from one right guess badly made.
        const verdict = gradeRhythm([0, 200], [180]);
        expect(verdict.hits[0]).toBeNull();
        expect(verdict.hits[1]?.deltaMs).toBe(-20);
        expect(verdict).toMatchObject({ perfect: 1, off: 0, missed: 1, extra: 0 });
    });

    it("does not shunt every later tap onto the wrong note after one miss", () => {
        const verdict = gradeRhythm(FOUR, [BEAT, 2 * BEAT, 3 * BEAT]);
        expect(verdict).toMatchObject({ perfect: 3, missed: 1, extra: 0, off: 0 });
        expect(verdict.hits[0]).toBeNull();
    });

    it("keeps the sign of the error, so early and late are told apart", () => {
        const verdict = gradeRhythm([BEAT], [BEAT - 40]);
        expect(verdict.hits[0]?.deltaMs).toBe(-40);
        expect(gradeRhythm([BEAT], [BEAT + 40]).hits[0]?.deltaMs).toBe(40);
    });

    it("counts a tap aimed at a note but badly out as off, not as a miss and a spare", () => {
        // Two mistakes reported where the player made one would read as a much worse
        // attempt than it was.
        const verdict = gradeRhythm([BEAT], [BEAT + 300]);
        expect(verdict).toMatchObject({ off: 1, missed: 0, extra: 0 });
    });

    it("widens the windows for an input that cannot tap precisely", () => {
        const strict = gradeRhythm([BEAT], [BEAT + 100]);
        const lenient = gradeRhythm([BEAT], [BEAT + 100], LENIENT_TOLERANCE);
        expect(strict.hits[0]?.rating).toBe("good");
        expect(lenient.hits[0]?.rating).toBe("perfect");
    });

    it("gives one tap to one note, however close two notes are", () => {
        const verdict = gradeRhythm([0, 60], [10]);
        const landed = verdict.hits.filter((hit) => hit !== null);
        expect(landed).toHaveLength(1);
        expect(verdict).toMatchObject({ missed: 1, extra: 0 });
    });

    it("says a rhythm read wrongly is off, however well its notes were timed", () => {
        // A missed note outranks the timing: reading a rhythm wrongly and playing one
        // loosely are different mistakes, and calling the first "good" would be a lie.
        const verdict = gradeRhythm(FOUR, [0, BEAT, 2 * BEAT]);
        expect(verdict.perfect).toBe(3);
        expect(rhythmVerdictRating(verdict)).toBe("off");
    });

    it("reports an empty attempt as every note missed", () => {
        expect(gradeRhythm(FOUR, [])).toMatchObject({ missed: 4, extra: 0, total: 4 });
    });
});
