// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    advancePlacement,
    MAX_STRIKES,
    PASS_SCORE,
    type Placement,
    PLACEMENT_GRADES,
    placementGrade,
    placementProgress,
    placementRating,
    startPlacement,
    STEPS_PER_GRADE,
    TOP_LEVEL,
} from "./placement";

// The placement test walks a player up a ladder until they miss three times. It decides
// where somebody starts, so the laws that matter are the ones a player would feel: the
// ladder cannot run past its top or below its bottom, a pass never costs you ground, and
// the test always ends.

const arbScore = fc.integer({ min: 0, max: 100 });
const arbRun = fc.array(arbScore, { maxLength: 40 });

const play = (scores: number[], from = 1) =>
    scores.reduce<Placement>(
        (state, score) => advancePlacement(state, score),
        startPlacement(from),
    );

describe("placement, walked up its ladder", () => {
    it("stays on the ladder, whatever the scores", () => {
        fc.assert(
            fc.property(arbRun, fc.integer({ min: -50, max: 50 }), (scores, from) => {
                const state = play(scores, from);

                expect(state.level).toBeGreaterThanOrEqual(1);
                expect(state.level).toBeLessThanOrEqual(TOP_LEVEL);
                expect(state.cleared).toBeGreaterThanOrEqual(0);
                expect(state.cleared).toBeLessThanOrEqual(TOP_LEVEL);
                expect(state.strikes).toBeGreaterThanOrEqual(0);
                expect(state.strikes).toBeLessThanOrEqual(MAX_STRIKES);
            }),
        );
    });

    it("never takes back ground a player has cleared", () => {
        fc.assert(
            fc.property(arbRun, (scores) => {
                let state = startPlacement();
                for (const score of scores) {
                    const next = advancePlacement(state, score);
                    expect(next.cleared).toBeGreaterThanOrEqual(state.cleared);
                    expect(placementGrade(next)).toBeGreaterThanOrEqual(placementGrade(state));
                    expect(placementRating(next)).toBeGreaterThanOrEqual(placementRating(state));
                    if (score >= PASS_SCORE && !state.done) {
                        expect(next.level).toBeGreaterThanOrEqual(state.level);
                        expect(next.strikes).toBe(state.strikes);
                    }
                    state = next;
                }
            }),
        );
    });

    it("ends, and stays ended", () => {
        fc.assert(
            fc.property(arbRun, (scores) => {
                const state = play(scores);
                if (!state.done) {
                    return;
                }
                // Nothing moves once the test is over, whatever is played at it.
                expect(advancePlacement(state, 100)).toEqual(state);
                expect(advancePlacement(state, 0)).toEqual(state);
                expect(placementProgress(state)).toBe(1);
            }),
        );
    });

    it("cannot be failed by passing, nor passed by failing", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: TOP_LEVEL }), arbScore, (from, score) => {
                const state = advancePlacement(startPlacement(from), score);

                if (score >= PASS_SCORE) {
                    expect(state.strikes).toBe(0);
                } else {
                    expect(state.strikes).toBe(1);
                    expect(state.cleared).toBe(0);
                }
                expect(state.scores).toEqual([score]);
            }),
        );
    });

    it("three misses end it, however they are spread through the run", () => {
        fc.assert(
            fc.property(arbRun, (scores) => {
                const state = play(scores);
                const misses = scores.filter((score) => score < PASS_SCORE).length;

                if (misses >= MAX_STRIKES) {
                    expect(state.done).toBe(true);
                }
                if (state.done && state.strikes < MAX_STRIKES) {
                    // The other way out: the top of the ladder was cleared.
                    expect(state.cleared).toBe(TOP_LEVEL);
                }
            }),
        );
    });

    it("reports a grade inside the ladder, and progress inside its bounds", () => {
        fc.assert(
            fc.property(arbRun, (scores) => {
                const state = play(scores);

                expect(placementGrade(state)).toBeGreaterThanOrEqual(1);
                expect(placementGrade(state)).toBeLessThanOrEqual(PLACEMENT_GRADES);
                expect(placementProgress(state)).toBeGreaterThanOrEqual(0);
                expect(placementProgress(state)).toBeLessThanOrEqual(1);
                // A grade is three rungs; clearing them all is the top grade.
                if (state.cleared === TOP_LEVEL) {
                    expect(placementGrade(state)).toBe(PLACEMENT_GRADES);
                    expect(TOP_LEVEL).toBe(PLACEMENT_GRADES * STEPS_PER_GRADE);
                }
            }),
        );
    });
});
