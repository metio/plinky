// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { CHORD_QUALITIES, SCALE_IDS } from "./theory";
import { courseProgress, LESSONS, lessonById, lessonsIn, UNITS } from "./theoryCourse";

describe("LESSONS", () => {
    it("gives every lesson a unique id and a real unit", () => {
        expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length);
        for (const lesson of LESSONS) {
            expect(UNITS).toContain(lesson.unit);
        }
    });

    it("leaves no unit empty, so no heading stands over nothing", () => {
        for (const unit of UNITS) {
            expect(lessonsIn(unit).length).toBeGreaterThan(0);
        }
    });

    it("accounts for every lesson exactly once across the units", () => {
        expect(UNITS.flatMap(lessonsIn)).toHaveLength(LESSONS.length);
    });

    it("names only scales and chords the theory module can build", () => {
        for (const lesson of LESSONS) {
            if (lesson.demo.kind === "scale") {
                expect(SCALE_IDS).toContain(lesson.demo.scale);
            }
            if (lesson.demo.kind === "chord") {
                expect(CHORD_QUALITIES).toContain(lesson.demo.quality);
            }
        }
    });

    it("gives every comparison two different things to compare", () => {
        for (const lesson of LESSONS) {
            if (lesson.demo.kind === "compare") {
                expect(lesson.demo.first).not.toEqual(lesson.demo.second);
                expect(lesson.demo.first.length).toBeGreaterThan(0);
                expect(lesson.demo.second.length).toBeGreaterThan(0);
            }
        }
    });
});

describe("lessonById", () => {
    it("finds a lesson, and nothing for one that does not exist", () => {
        expect(lessonById("triads")?.unit).toBe("harmony");
        expect(lessonById("nonsense")).toBeNull();
    });
});

describe("courseProgress", () => {
    it("runs from nothing to all of it", () => {
        expect(courseProgress([])).toBe(0);
        expect(courseProgress(LESSONS.map((lesson) => lesson.id))).toBe(1);
    });

    it("ignores an id the course does not have, and counts a repeat once", () => {
        // A stored id from a lesson that was renamed or dropped must not push the
        // reading past the end.
        expect(courseProgress(["staff", "staff", "nonsense"])).toBeCloseTo(1 / LESSONS.length);
    });
});
