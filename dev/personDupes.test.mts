// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { candidatePairs, compare, creditedPeople, pairKey, parseRulings } from "./personDupes.mts";

describe("who the catalogue credits", () => {
    it("counts every person a shared credit names", () => {
        const counts = creditedPeople([
            "Bartholomäus Gesius / Georg Philipp Telemann",
            "Georg Philipp Telemann",
        ]);

        expect(counts.get("Georg Philipp Telemann")).toBe(2);
        expect(counts.get("Bartholomäus Gesius")).toBe(1);
    });

    it("counts one person once when a credit names them twice", () => {
        // Otherwise the report pairs somebody with themselves.
        const counts = creditedPeople(["J. S. Bach / Johann Sebastian Bach"]);

        expect([...counts.keys()]).toEqual(["Johann Sebastian Bach"]);
        expect(counts.get("Johann Sebastian Bach")).toBe(1);
    });

    it("credits nobody for an attribution that names no person", () => {
        expect(creditedPeople(["Traditional", "Anonymous", ""]).size).toBe(0);
    });
});

describe("finding pages that might be one person", () => {
    it("catches a surname carrying two first names", () => {
        const pairs = candidatePairs(["Robert Schumann", "Clara Schumann"]);

        expect(pairs).toHaveLength(1);
        expect(pairs[0]?.why).toBe("same surname");
    });

    it("catches the split that went unnoticed until a reader found it", () => {
        // Burgmüller held three pages: a bare surname, an un-umlauted spelling and his full
        // name. Every pair among them is a candidate, so any one of them would have raised
        // the question — had anything been running this.
        const pairs = candidatePairs([
            "Burgmüller",
            "Johann Friedrich Burgmuller",
            "Johann Friedrich Franz Burgmüller",
        ]);

        expect(pairs.length).toBeGreaterThanOrEqual(3);
        expect(pairs.every((one) => one.why === "same surname")).toBe(true);
    });

    it("catches a surname that differs by one letter", () => {
        expect(candidatePairs(["Friedrich Kuhlau", "Johann Kuhnau"])[0]?.why).toBe(
            "surname differs by one letter",
        );
    });

    it("catches a credit that was cut short", () => {
        // Every word of the shorter name appears in the longer, and the surnames differ —
        // which is what a truncated credit looks like. Two names sharing a surname are
        // caught by the test above instead, before this one is reached.
        expect(candidatePairs(["Johann Sebastian Bach", "Johann Sebastian"])[0]?.why).toBe(
            "one name is contained in the other",
        );
    });

    it("ignores a surname too short to compare", () => {
        expect(candidatePairs(["Peter Sun", "Mary Sun"])).toEqual([]);
    });

    it("leaves unrelated names alone", () => {
        expect(candidatePairs(["Erik Satie", "Claude Debussy", "Maurice Ravel"])).toEqual([]);
    });

    it("reports a pair once, whichever order it meets them in", () => {
        const one = candidatePairs(["Robert Schumann", "Clara Schumann"]);
        const other = candidatePairs(["Clara Schumann", "Robert Schumann"]);

        expect(one).toHaveLength(1);
        expect(other).toHaveLength(1);
        expect(pairKey(one[0]!.a, one[0]!.b)).toBe(pairKey(other[0]!.a, other[0]!.b));
    });
});

describe("holding the candidates against what somebody ruled", () => {
    const pairs = candidatePairs(["Robert Schumann", "Clara Schumann"]);

    it("passes a pair that has been ruled on, written either way round", () => {
        const backwards = [{ a: "Clara Schumann", b: "Robert Schumann", why: "married" }];

        expect(compare(pairs, backwards)).toEqual({ unruled: [], unused: [] });
    });

    it("reports a pair nobody has ruled on", () => {
        expect(compare(pairs, []).unruled).toHaveLength(1);
    });

    it("reports a ruling the catalogue no longer pairs", () => {
        // A file of rulings about composers who have left is a file that has quietly
        // stopped being about anything.
        const stale = [{ a: "Somebody Gone", b: "Somebody Else", why: "no longer here" }];

        expect(compare(pairs, stale).unused).toHaveLength(1);
    });
});

describe("reading the rulings file", () => {
    const one = { a: "Robert Schumann", b: "Clara Schumann", why: "married, and both composed" };

    it("accepts a well-formed ruling", () => {
        expect(parseRulings([one])).toEqual({ rulings: [one], problems: [] });
    });

    it("refuses a ruling with no reason", () => {
        // A bare pair, a year later, is indistinguishable from somebody silencing the gate.
        const { problems } = parseRulings([{ a: "A Person", b: "B Person", why: "  " }]);

        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain("why");
    });

    it("refuses a field nobody meant to add", () => {
        expect(parseRulings([{ ...one, merged: true }]).problems[0]).toContain("unknown field");
    });

    it("refuses the same pair twice", () => {
        const twice = parseRulings([one, { a: "Clara Schumann", b: "Robert Schumann", why: "x" }]);

        expect(twice.problems[0]).toContain("twice");
    });

    it("refuses a file that is not a list", () => {
        expect(parseRulings({ a: 1 }).problems).toHaveLength(1);
    });
});
