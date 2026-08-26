// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { CIRCLE } from "./circleOfFifths";
import { buildSnippet } from "./glossaryScore";
import { courseProgress, LESSONS, lessonById, lessonsIn, UNITS } from "./theoryCourse";
import { demoMoments, demoNotes, demoSnippet } from "./theoryDemo";

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

    it("gives every lesson notes to sound", () => {
        // A lesson is a thing you do. One with nothing to hear is a paragraph.
        for (const lesson of LESSONS) {
            expect(demoNotes(lesson.demo).length, lesson.id).toBeGreaterThan(0);
        }
    });

    it("draws every lesson on a stave, not just the ones about reading", () => {
        // Eight of the fourteen had no written example at all, because the page only drew
        // one for the reading unit. A chord is as much a thing on a page as a rest is.
        for (const lesson of LESSONS) {
            const snippet = demoSnippet(lesson.demo);
            expect(snippet.notes.length, lesson.id).toBeGreaterThan(0);
            expect(() => buildSnippet(snippet), lesson.id).not.toThrow();
        }
    });

    it("fills whole bars, so no lesson draws a bar that does not add up", () => {
        for (const lesson of LESSONS) {
            const beats = lesson.demo.steps.reduce(
                (total, step) => total + (BEATS[step.value] ?? 0),
                0,
            );
            expect(beats % 4, lesson.id).toBe(0);
        }
    });

    it("keeps every lesson's notes on the keyboard it draws", () => {
        // The bass lesson sounded three notes below middle C under a keyboard that starts
        // at middle C, so it lit nothing at all. A lesson's range has to hold its notes.
        for (const lesson of LESSONS) {
            for (const note of demoNotes(lesson.demo)) {
                expect(note, `${lesson.id} low`).toBeGreaterThanOrEqual(lesson.demo.from);
                expect(note, `${lesson.id} high`).toBeLessThanOrEqual(lesson.demo.to);
            }
        }
    });

    it("sounds what it draws, and draws what it sounds", () => {
        // The defect this closes, at its root: the drawing and the playing were derived
        // separately and disagreed. Every pitch a lesson sounds is now a pitch it drew.
        for (const lesson of LESSONS) {
            const drawn = demoSnippet(lesson.demo).notes.filter((note) => note.step !== null);
            const sounded = demoMoments(lesson.demo).flatMap((moment) => moment.notes);
            expect(drawn.length, lesson.id).toBe(sounded.length);
        }
    });

    it("names a key the circle actually holds, where a lesson shows one", () => {
        for (const lesson of LESSONS) {
            if (lesson.demo.circle !== undefined) {
                expect(
                    CIRCLE.map((one) => one.tonic),
                    lesson.id,
                ).toContain(lesson.demo.circle);
            }
        }
    });
});

// A bar's worth of each written length, for the sum above.
const BEATS: Record<string, number> = {
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    sixteenth: 0.25,
};

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
