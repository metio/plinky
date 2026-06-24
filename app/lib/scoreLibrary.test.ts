// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { loadScores } from "./scoreLibrary";

describe("scoreLibrary", () => {
    it("loads the bundled scores with title and composer from each file", () => {
        const scores = loadScores();
        expect(scores.length).toBeGreaterThanOrEqual(2);

        const ode = scores.find((score) => score.id === "ode-to-joy");
        expect(ode?.title).toBe("Ode to Joy");
        expect(ode?.composer).toBe("Ludwig van Beethoven");
        expect(ode?.xml).toContain("score-partwise");

        const twinkle = scores.find((score) => score.id === "twinkle-twinkle");
        expect(twinkle?.title).toBe("Twinkle, Twinkle, Little Star");
        expect(twinkle?.composer).toBe("Traditional");
    });

    it("returns scores sorted by title", () => {
        const titles = loadScores().map((score) => score.title);
        expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    });
});
