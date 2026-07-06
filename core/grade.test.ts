// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { computeGrade, GRADE_COLOR, type Grade, letterFor, parseGrade, scoreKeepUp } from "./grade";

const PERFECT_RHYTHM = { perfect: 10, good: 0, off: 0, total: 10, averageAbsMs: 0 };

describe("scoreKeepUp", () => {
    it("counts the notes played in time and grades the ratio", () => {
        expect(scoreKeepUp([true, true, true, true])).toEqual({ inTime: 4, total: 4, letter: "S" });
        expect(scoreKeepUp([true, false, true, false])).toEqual({
            inTime: 2,
            total: 4,
            letter: "E", // 50% → the E band (>= 40)
        });
    });

    it("grades a mostly-kept-up run in the middle of the ladder", () => {
        // 8 of 10 in time → 80% → B.
        const hits = [...Array(8).fill(true), false, false];
        expect(scoreKeepUp(hits)).toEqual({ inTime: 8, total: 10, letter: "B" });
    });

    it("is F for an empty run rather than dividing by zero", () => {
        expect(scoreKeepUp([])).toEqual({ inTime: 0, total: 0, letter: "F" });
    });
});

describe("parseGrade", () => {
    const valid: Grade = {
        accuracy: 90,
        timing: 80,
        flow: 85,
        dynamics: 70,
        score: 84,
        letter: "B",
    };

    it("accepts a well-formed grade, including a null dynamics", () => {
        expect(parseGrade(valid)).toEqual(valid);
        expect(parseGrade({ ...valid, dynamics: null })).toEqual({ ...valid, dynamics: null });
    });

    it("rejects a non-object", () => {
        for (const bad of [null, undefined, 42, "grade", []]) {
            expect(parseGrade(bad)).toBeNull();
        }
    });

    it("rejects a grade with a non-numeric or non-finite dimension", () => {
        expect(parseGrade({ ...valid, accuracy: "90" })).toBeNull();
        expect(parseGrade({ ...valid, timing: Number.NaN })).toBeNull();
        expect(parseGrade({ ...valid, flow: Number.POSITIVE_INFINITY })).toBeNull();
    });

    it("rejects an unknown grade letter", () => {
        expect(parseGrade({ ...valid, letter: "Z" })).toBeNull();
        expect(parseGrade({ ...valid, letter: 3 })).toBeNull();
    });

    it("rejects a missing dimension", () => {
        const missingFlow: Record<string, unknown> = { ...valid };
        delete missingFlow.flow;
        expect(parseGrade(missingFlow)).toBeNull();
    });

    it("accepts each of the seven grade letters", () => {
        // Every letter must round-trip: a hole in the LETTERS list would reject a
        // legitimately-stored grade as unparsable.
        for (const letter of ["S", "A", "B", "C", "D", "E", "F"] as const) {
            expect(parseGrade({ ...valid, letter })).toEqual({ ...valid, letter });
        }
    });

    it("rejects a dynamics that is neither null nor a finite number", () => {
        expect(parseGrade({ ...valid, dynamics: "70" })).toBeNull();
        expect(parseGrade({ ...valid, dynamics: Number.NaN })).toBeNull();
    });
});

describe("GRADE_COLOR", () => {
    it("maps every letter to its contrast-safe light/dark colour classes", () => {
        expect(GRADE_COLOR).toEqual({
            S: "text-amber-500 dark:text-amber-300",
            A: "text-green-600 dark:text-green-400",
            B: "text-lime-600 dark:text-lime-400",
            C: "text-yellow-600 dark:text-yellow-400",
            D: "text-orange-600 dark:text-orange-400",
            E: "text-red-600 dark:text-red-400",
            F: "text-red-800 dark:text-red-500",
        });
    });
});

describe("computeGrade timing weighting", () => {
    const rhythm = (perfect: number, good: number, off: number) => ({
        perfect,
        good,
        off,
        total: perfect + good + off,
        averageAbsMs: 0,
    });

    it("credits a good note 0.6 and an off note 0, over every graded note", () => {
        // (2 + 2*0.6) / (2 + 2 + 2) * 100 = 53.
        const grade = computeGrade({
            correct: 6,
            wrong: 0,
            rhythm: rhythm(2, 2, 2),
            flow: 100,
            dynamics: null,
        });
        expect(grade.timing).toBe(53);
    });

    it("is a full 100 when a played run had no rhythm-graded notes", () => {
        const grade = computeGrade({
            correct: 3,
            wrong: 0,
            rhythm: rhythm(0, 0, 0),
            flow: 100,
            dynamics: null,
        });
        expect(grade.timing).toBe(100);
    });
});

describe("grade", () => {
    it("maps scores to letters with S at the top", () => {
        expect(letterFor(100)).toBe("S");
        expect(letterFor(95)).toBe("S");
        expect(letterFor(90)).toBe("A");
        expect(letterFor(80)).toBe("B");
        expect(letterFor(70)).toBe("C");
        expect(letterFor(60)).toBe("D");
        expect(letterFor(45)).toBe("E");
        expect(letterFor(0)).toBe("F");
    });

    it("grades a clean, in-time, flowing run as S", () => {
        const grade = computeGrade({
            correct: 10,
            wrong: 0,
            rhythm: PERFECT_RHYTHM,
            flow: 100,
            dynamics: { mean: 80, evenness: 100, label: "even" },
        });
        expect(grade.accuracy).toBe(100);
        expect(grade.timing).toBe(100);
        expect(grade.flow).toBe(100);
        expect(grade.dynamics).toBe(100);
        expect(grade.letter).toBe("S");
    });

    it("lowers the score for broken flow", () => {
        const grade = computeGrade({
            correct: 10,
            wrong: 0,
            rhythm: PERFECT_RHYTHM,
            flow: 40,
            dynamics: null,
        });
        // mean(100, 100, 40) = 80 → B
        expect(grade.flow).toBe(40);
        expect(grade.score).toBe(80);
        expect(grade.letter).toBe("B");
    });

    it("lowers accuracy for wrong notes", () => {
        const grade = computeGrade({
            correct: 5,
            wrong: 5,
            rhythm: { perfect: 5, good: 0, off: 0, total: 5, averageAbsMs: 0 },
            flow: 100,
            dynamics: null,
        });
        expect(grade.accuracy).toBe(50);
    });

    it("keeps dynamics out of the aggregate so it never changes the letter", () => {
        const base = { correct: 10, wrong: 0, rhythm: PERFECT_RHYTHM, flow: 100 } as const;
        const great = computeGrade({
            ...base,
            dynamics: { mean: 80, evenness: 100, label: "even" },
        });
        const poor = computeGrade({
            ...base,
            dynamics: { mean: 80, evenness: 10, label: "uneven" },
        });
        expect(great.score).toBe(poor.score);
        expect(great.letter).toBe(poor.letter);
        expect(poor.dynamics).toBe(10);
    });

    it("grades a run with nothing played as a consistent F", () => {
        const grade = computeGrade({
            correct: 0,
            wrong: 0,
            rhythm: { perfect: 0, good: 0, off: 0, total: 0, averageAbsMs: 0 },
            flow: 100,
            dynamics: null,
        });
        expect(grade).toMatchObject({ accuracy: 0, timing: 0, flow: 0, score: 0, letter: "F" });
    });

    it("drops dynamics to null when there is no real velocity", () => {
        const grade = computeGrade({
            correct: 10,
            wrong: 0,
            rhythm: PERFECT_RHYTHM,
            flow: 100,
            dynamics: null,
        });
        expect(grade.dynamics).toBeNull();
        expect(grade.score).toBe(100);
    });
});
