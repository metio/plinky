// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type Anchor, type Row, spearman, unresolved } from "./calibrate-grades.mts";

const anchor = (over: Partial<Anchor> = {}): Anchor => ({
    grade: 5,
    label: "Bach, Two-part Inventions",
    composer: "bach",
    title: "^Invention",
    least: 2,
    ...over,
});
const song = (title: string, composer: string, scoreKind = "solo-piano"): Row => ({
    id: title,
    title,
    composer,
    license: "CC0-1.0",
    scoreKind,
});

describe("unresolved", () => {
    it("says nothing while a collection still resolves to its floor", () => {
        expect(
            unresolved(
                [anchor()],
                [song("Invention 1", "J. S. Bach"), song("Invention 2", "Bach")],
            ),
        ).toEqual([]);
    });

    it("names a collection that has fallen below what makes it that collection", () => {
        const problems = unresolved([anchor()], [song("Invention 1", "Bach")]);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain("Bach, Two-part Inventions");
        expect(problems[0]).toContain("resolves to 1 piece(s), fewer than the 2");
    });

    it("catches a pattern that has stopped matching entirely", () => {
        const problems = unresolved(
            [anchor({ title: "^Inventio nes" })],
            [song("Invention 1", "Bach")],
        );
        expect(problems[0]).toContain("resolves to 0 piece(s)");
    });

    it("counts only solo piano, since that is what the boundaries are cut over", () => {
        const problems = unresolved(
            [anchor()],
            [song("Invention 1", "Bach"), song("Invention 2", "Bach", "voice-and-piano")],
        );
        expect(problems[0]).toContain("resolves to 1 piece(s)");
    });

    it("reports every collection that has gone, not just the first", () => {
        const problems = unresolved(
            [anchor(), anchor({ label: "Satie, Gymnopedies", composer: "satie", title: "gymnop" })],
            [],
        );
        expect(problems).toHaveLength(2);
    });
});

describe("spearman", () => {
    it("is 1 for a perfect agreement and -1 for a perfect reversal", () => {
        expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
        expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
    });

    it("gives tied values their shared rank rather than an arbitrary order", () => {
        // Both orderings of the tie must score the same, or the number depends on
        // which of two equal costs happened to be read first.
        expect(spearman([1, 2, 2, 3], [1, 5, 5, 9])).toBeCloseTo(
            spearman([1, 2, 2, 3], [1, 5, 5, 9].reverse().reverse()),
        );
        expect(spearman([1, 1], [5, 5])).toBe(0);
    });
});
