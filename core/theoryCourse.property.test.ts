// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { courseProgress, LESSONS, lessonById, lessonsIn, UNITS } from "./theoryCourse";
import { demoDurationMs, demoMoments, demoNotes } from "./theoryDemo";

// The theory course: a page per lesson, each with something to hear and see under the
// text. Two kinds of fault live here and neither shows on the lesson that has it. One is
// content rot — a lesson that no longer resolves by the name its page is prerendered
// under, or one filed under no unit, so the course index never links to it. The other is
// the demonstration: a lesson about notes below middle C whose keyboard does not reach
// them illustrates nothing, which is a thing a reader sees and a test can state.

const arbLesson = fc.constantFrom(...LESSONS);

describe("the course as a set of lessons", () => {
    it("gives every lesson one page, addressable by its own name", () => {
        expect(LESSONS.length).toBeGreaterThan(0);
        const ids = LESSONS.map((lesson) => lesson.id);
        expect(new Set(ids).size).toBe(ids.length);
        fc.assert(
            fc.property(arbLesson, (lesson) => {
                // The id is the URL segment: react-router.config prerenders
                // /theory/<id>, and every other address on the site is lower case, so a
                // lesson named in camelCase would 404 for anyone who typed it plainly.
                expect(lesson.id).toMatch(/^[a-z0-9-]+$/);
                expect(lessonById(lesson.id)).toBe(lesson);
            }),
        );
    });

    it("files every lesson under exactly one unit", () => {
        const filed = UNITS.flatMap((unit) => lessonsIn(unit));

        // The index is built unit by unit, so a lesson in none of them is a page the
        // course never links to and nobody reaches.
        expect(filed.length).toBe(LESSONS.length);
        expect(new Set(filed).size).toBe(LESSONS.length);
        fc.assert(
            fc.property(arbLesson, (lesson) => {
                expect(UNITS).toContain(lesson.unit);
            }),
        );
    });

    it("reads anything else as no lesson at all", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 20 }), (id) => {
                fc.pre(!LESSONS.some((lesson) => lesson.id === id));

                expect(lessonById(id)).toBeNull();
            }),
        );
        for (const hazard of ["constructor", "toString", "__proto__", ""]) {
            expect(lessonById(hazard)).toBeNull();
        }
    });
});

describe("how far through the course a reader is", () => {
    const arbDone = fc.array(
        fc.oneof(
            fc.constantFrom(...LESSONS.map((lesson) => lesson.id)),
            fc.string({ maxLength: 8 }),
        ),
        { maxLength: 30 },
    );

    it("answers a fraction of the course, whatever it is handed", () => {
        fc.assert(
            fc.property(arbDone, (done) => {
                const progress = courseProgress(done);

                expect(progress).toBeGreaterThanOrEqual(0);
                expect(progress).toBeLessThanOrEqual(1);
                expect(Number.isFinite(progress)).toBe(true);
            }),
        );
    });

    it("never goes backwards for finishing another lesson", () => {
        fc.assert(
            fc.property(arbDone, arbLesson, (done, lesson) => {
                // The course keeps no schedule and nothing expires: it is a thing to
                // finish once, so progress can only ever rise.
                expect(courseProgress([...done, lesson.id])).toBeGreaterThanOrEqual(
                    courseProgress(done),
                );
            }),
        );
    });

    it("counts a lesson once, and counts nothing it does not have", () => {
        fc.assert(
            fc.property(arbDone, (done) => {
                const known = done.filter((id) => lessonById(id) !== null);

                // Repeats and ids from a removed lesson are both things a restored
                // backup carries, and neither may inflate the figure.
                expect(courseProgress(done)).toBeCloseTo(new Set(known).size / LESSONS.length, 9);
                expect(courseProgress([...done, ...done])).toBe(courseProgress(done));
            }),
        );
        expect(courseProgress([])).toBe(0);
        expect(courseProgress(LESSONS.map((lesson) => lesson.id))).toBe(1);
    });
});

describe("what a lesson puts under its text", () => {
    it("draws a keyboard that holds the notes it demonstrates", () => {
        fc.assert(
            fc.property(arbLesson, (lesson) => {
                const { demo } = lesson;

                expect(demo.to).toBeGreaterThan(demo.from);
                for (const note of demoNotes(demo)) {
                    // The bass-clef lesson is about notes below middle C, and drew a
                    // keyboard with none of them on it.
                    expect(note).toBeGreaterThanOrEqual(demo.from);
                    expect(note).toBeLessThanOrEqual(demo.to);
                }
            }),
        );
    });

    it("has something to hear, in order, inside the time it says it takes", () => {
        fc.assert(
            fc.property(arbLesson, fc.integer({ min: 200, max: 1200 }), (lesson, beatMs) => {
                const moments = demoMoments(lesson.demo, beatMs);
                const total = demoDurationMs(lesson.demo, beatMs);

                expect(moments.length).toBeGreaterThan(0);
                const starts = moments.map((moment) => moment.atMs);
                expect([...starts].sort((a, b) => a - b)).toEqual(starts);
                expect(total).toBeGreaterThan(0);
                for (const moment of moments) {
                    expect(moment.notes.length).toBeGreaterThan(0);
                    expect(moment.atMs).toBeGreaterThanOrEqual(0);
                    expect(moment.forMs).toBeGreaterThan(0);
                    // Struck and finished inside the time the demonstration says it
                    // takes, or the keyboard goes back to resting mid-note.
                    expect(moment.atMs + moment.forMs).toBeLessThanOrEqual(total + 1e-9);
                }
            }),
        );
    });

    it("runs twice as fast at twice the beat", () => {
        fc.assert(
            fc.property(arbLesson, fc.integer({ min: 200, max: 800 }), (lesson, beatMs) => {
                const slow = demoMoments(lesson.demo, beatMs);
                const fast = demoMoments(lesson.demo, beatMs * 2);

                expect(fast.length).toBe(slow.length);
                fast.forEach((moment, at) => {
                    expect(moment.atMs).toBeCloseTo((slow[at]?.atMs ?? 0) * 2, 6);
                    expect(moment.forMs).toBeCloseTo((slow[at]?.forMs ?? 0) * 2, 6);
                    expect(moment.notes).toEqual(slow[at]?.notes);
                });
                expect(demoDurationMs(lesson.demo, beatMs * 2)).toBeCloseTo(
                    demoDurationMs(lesson.demo, beatMs) * 2,
                    6,
                );
            }),
        );
    });
});
