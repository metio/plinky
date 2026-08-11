// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { generateDrill } from "./drill";
import {
    advancePlacement,
    levelDrill,
    MAX_STRIKES,
    PASS_SCORE,
    PLACEMENT_GRADES,
    type Placement,
    placementGrade,
    placementProgress,
    placementRating,
    startPlacement,
    STEPS_PER_GRADE,
    TOP_LEVEL,
} from "./placement";

// Read a whole test through, one score per drill.
function walk(scores: number[], from = 1): Placement {
    return scores.reduce((state, score) => advancePlacement(state, score), startPlacement(from));
}

describe("the ladder", () => {
    it("climbs a rung for every clean read", () => {
        const state = walk([90, 85, 100]);

        expect(state.level).toBe(4);
        expect(state.cleared).toBe(3);
        expect(state.strikes).toBe(0);
        expect(state.done).toBe(false);
    });

    it("stays on the rung that caught the reader rather than dropping them", () => {
        const state = walk([90, 50]);

        // Still level 2: a shaky run earns another drill at the same height.
        expect(state.level).toBe(2);
        expect(state.strikes).toBe(1);
        expect(state.cleared).toBe(1);
    });

    it("ends after three misses", () => {
        const state = walk([90, 10, 20, 30]);

        expect(state.strikes).toBe(MAX_STRIKES);
        expect(state.done).toBe(true);
    });

    it("lets misses come from anywhere, not in a row", () => {
        const state = walk([30, 90, 30, 90, 30]);

        expect(state.done).toBe(true);
        expect(state.strikes).toBe(3);
    });

    it("treats the threshold itself as a pass", () => {
        expect(walk([PASS_SCORE]).cleared).toBe(1);
        expect(walk([PASS_SCORE - 1]).cleared).toBe(0);
    });

    it("ends when there is nothing harder left to ask", () => {
        const state = walk(Array.from({ length: TOP_LEVEL }, () => 100));

        expect(state.cleared).toBe(TOP_LEVEL);
        expect(state.done).toBe(true);
        expect(state.level).toBe(TOP_LEVEL);
    });

    it("ignores anything after it is over", () => {
        const over = walk([10, 10, 10]);

        expect(advancePlacement(over, 100)).toBe(over);
    });

    it("keeps every score it was given", () => {
        expect(walk([90, 40, 85]).scores).toEqual([90, 40, 85]);
    });

    it("can start partway up for a reader who already has a grade", () => {
        const state = startPlacement(10);

        expect(state.level).toBe(10);
        expect(state.cleared).toBe(0);
    });

    it("refuses a starting rung off the ladder", () => {
        expect(startPlacement(0).level).toBe(1);
        expect(startPlacement(-5).level).toBe(1);
        expect(startPlacement(999).level).toBe(TOP_LEVEL);
        expect(startPlacement(Number.NaN).level).toBe(1);
    });
});

describe("the result", () => {
    it("reports a hundred per rung cleared", () => {
        expect(placementRating(walk([90, 90, 90]))).toBe(300);
        expect(placementRating(walk([10, 10, 10]))).toBe(0);
    });

    it("says start at the beginning when nothing was cleared", () => {
        const state = walk([10, 10, 10]);

        // Grade 1, not grade 0 — there is no such thing, and the answer is still
        // a real one: begin here.
        expect(placementGrade(state)).toBe(1);
    });

    it("maps rungs onto the grade ladder the rest of the app speaks", () => {
        expect(placementGrade(walk([90, 90, 90]))).toBe(1);
        expect(placementGrade(walk([90, 90, 90, 90]))).toBe(2);
        expect(placementGrade(walk(Array.from({ length: TOP_LEVEL }, () => 100)))).toBe(
            PLACEMENT_GRADES,
        );
    });

    it("never promises a grade past the ladder", () => {
        const state = walk(Array.from({ length: TOP_LEVEL + 5 }, () => 100));

        expect(placementGrade(state)).toBeLessThanOrEqual(PLACEMENT_GRADES);
    });
});

describe("progress", () => {
    it("runs from nothing to finished", () => {
        expect(placementProgress(startPlacement())).toBe(0);
        expect(placementProgress(walk([10, 10, 10]))).toBe(1);
    });

    it("moves on a strike as well as on a climb", () => {
        // A reader collecting strikes is getting closer to the end, and a bar that
        // sat still while they did would read as broken.
        expect(placementProgress(walk([50]))).toBeGreaterThan(0);
    });

    it("never goes backwards or past the end", () => {
        let state = startPlacement();
        let last = 0;
        for (const score of [90, 90, 40, 90, 40, 90, 40]) {
            state = advancePlacement(state, score);
            const now = placementProgress(state);
            expect(now).toBeGreaterThanOrEqual(last);
            expect(now).toBeLessThanOrEqual(1);
            last = now;
        }
    });
});

describe("the drills", () => {
    it("asks for something playable at every rung", () => {
        for (let level = 1; level <= TOP_LEVEL; level++) {
            const xml = generateDrill(levelDrill(level), Math.random);

            expect(xml).toContain("<score-partwise");
            expect(xml).toContain("<note>");
        }
    });

    it("starts a beginner in a five-finger position, one hand", () => {
        const first = levelDrill(1);

        expect(first.low).toBe(72);
        expect(first.high).toBe(79);
        expect(first.hands).toBe(1);
        expect(first.notesPerColumn).toBe(1);
        expect(first.chromatic).toBe(false);
    });

    it("never narrows as the ladder climbs", () => {
        // Each grade asks for at least as much range as the one below it: a ladder
        // that got easier partway up would place a reader below where they read.
        for (let grade = 2; grade <= PLACEMENT_GRADES; grade++) {
            const below = levelDrill((grade - 2) * STEPS_PER_GRADE + 1);
            const here = levelDrill((grade - 1) * STEPS_PER_GRADE + 1);

            expect(here.high - here.low).toBeGreaterThanOrEqual(below.high - below.low);
            expect(here.notesPerColumn).toBeGreaterThanOrEqual(below.notesPerColumn);
            expect(here.hands).toBeGreaterThanOrEqual(below.hands);
        }
    });

    it("lengthens the drill across a grade's three steps without reshaping it", () => {
        const [one, two, three] = [1, 2, 3].map((step) => levelDrill(step));

        expect(one?.bars).toBeLessThan(two?.bars ?? 0);
        expect(two?.bars).toBeLessThan(three?.bars ?? 0);
        // Same reading, sustained longer.
        expect(one?.low).toBe(three?.low);
        expect(one?.rhythm).toBe(three?.rhythm);
    });

    it("saves every note in the octave for the very top", () => {
        expect(levelDrill(TOP_LEVEL).chromatic).toBe(true);
        expect(levelDrill(TOP_LEVEL - STEPS_PER_GRADE).chromatic).toBe(false);
    });

    it("holds a rung off the ladder to one that is on it", () => {
        expect(levelDrill(0)).toEqual(levelDrill(1));
        expect(levelDrill(999)).toEqual(levelDrill(TOP_LEVEL));
    });
});
