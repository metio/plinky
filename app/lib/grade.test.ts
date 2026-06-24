// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { computeGrade, letterFor } from "./grade";

describe("grade", () => {
    it("maps scores to letters with S at the top", () => {
        expect(letterFor(100)).toBe("S");
        expect(letterFor(95)).toBe("S");
        expect(letterFor(90)).toBe("A");
        expect(letterFor(70)).toBe("B");
        expect(letterFor(50)).toBe("C");
        expect(letterFor(0)).toBe("D");
    });

    it("grades a clean, in-time, even run as S", () => {
        const grade = computeGrade({
            correct: 10,
            wrong: 0,
            rhythm: { perfect: 10, good: 0, off: 0, total: 10, averageAbsMs: 10 },
            dynamics: { mean: 80, evenness: 100, label: "even" },
        });
        expect(grade.accuracy).toBe(100);
        expect(grade.timing).toBe(100);
        expect(grade.dynamics).toBe(100);
        expect(grade.letter).toBe("S");
    });

    it("lowers accuracy for wrong notes", () => {
        const grade = computeGrade({
            correct: 5,
            wrong: 5,
            rhythm: { perfect: 5, good: 0, off: 0, total: 5, averageAbsMs: 0 },
            dynamics: null,
        });
        expect(grade.accuracy).toBe(50);
    });

    it("lowers timing for off-beat notes", () => {
        const grade = computeGrade({
            correct: 10,
            wrong: 0,
            rhythm: { perfect: 0, good: 0, off: 10, total: 10, averageAbsMs: 300 },
            dynamics: null,
        });
        expect(grade.timing).toBe(0);
    });

    it("drops dynamics when there is no real velocity", () => {
        const grade = computeGrade({
            correct: 10,
            wrong: 0,
            rhythm: { perfect: 10, good: 0, off: 0, total: 10, averageAbsMs: 0 },
            dynamics: null,
        });
        expect(grade.dynamics).toBeNull();
        expect(grade.score).toBe(100);
    });
});
