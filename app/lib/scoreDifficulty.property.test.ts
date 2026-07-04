// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Composition, toMusicXml } from "../../core/composition";
import { gradeOf, MAX_GRADE, rawDifficulty } from "./scoreDifficulty";

const arbNote = fc.record({
    pitch: fc.integer({ min: 21, max: 108 }),
    startMs: fc.nat({ max: 60_000 }),
    durationMs: fc.integer({ min: 1, max: 4000 }),
    velocity: fc.integer({ min: 0, max: 127 }),
});

// A playable score: notes in time order, engraved to the MusicXML the difficulty
// model reads.
const arbXml = fc
    .record({
        notes: fc.array(arbNote, { maxLength: 60 }),
        tempo: fc.integer({ min: 20, max: 300 }),
        beatsPerBar: fc.integer({ min: 1, max: 12 }),
    })
    .map((composition: Composition) => ({
        ...composition,
        notes: [...composition.notes].sort((a, b) => a.startMs - b.startMs),
    }))
    .map((composition) => toMusicXml(composition));

// gradeOf memoises by id, so each case needs a fresh id to actually exercise the
// generated score rather than returning the first cached grade.
let nextId = 0;

describe("scoreDifficulty invariants", () => {
    it("measures a finite, non-negative raw difficulty for any score", () => {
        fc.assert(
            fc.property(arbXml, (xml) => {
                const cost = rawDifficulty(xml);
                expect(Number.isFinite(cost)).toBe(true);
                expect(cost).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: 50 },
        );
    });

    it("places every score on the 1..MAX_GRADE ladder", () => {
        fc.assert(
            fc.property(fc.constantFrom("scale-", "arpeggio-", "piece-"), arbXml, (prefix, xml) => {
                const grade = gradeOf(`${prefix}${nextId++}`, xml);
                expect(Number.isInteger(grade)).toBe(true);
                expect(grade).toBeGreaterThanOrEqual(1);
                expect(grade).toBeLessThanOrEqual(MAX_GRADE);
            }),
            { numRuns: 50 },
        );
    });
});
