// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type Standing, standingParts } from "./standing";

const nothing: Standing = { level: 0, skill: 0, onStand: 0, notes: 0 };

describe("standingParts", () => {
    it("says nothing at all on a first visit", () => {
        // Four ways of saying you have not started, under a line that has just said
        // good morning, is worse than the greeting on its own.
        expect(standingParts(nothing)).toEqual([]);
    });

    it("keeps somebody who has played company until they have a grade", () => {
        // The case that caught this: a piece played through but not yet learned. Every
        // figure is still zero, and a blank line reads as the app having forgotten them.
        expect(standingParts({ ...nothing, notes: 340 })).toEqual(["not-graded", "notes"]);
    });

    it("drops the note count as soon as anything else has something to say", () => {
        expect(standingParts({ ...nothing, notes: 340, onStand: 1 })).toEqual([
            "not-graded",
            "stand",
        ]);
        expect(standingParts({ level: 2, skill: 140, onStand: 5, notes: 9000 })).toEqual([
            "grade",
            "skill",
            "stand",
        ]);
    });

    it("names the grade once there is one, and its absence until then", () => {
        expect(standingParts({ ...nothing, level: 3, notes: 1 })).toEqual(["grade"]);
        expect(standingParts({ ...nothing, skill: 12 })).toEqual(["not-graded", "skill"]);
    });

    it("states only what is there, in a fixed order", () => {
        // Grade, then skill, then the stand: strongest claim first, so a long line and
        // a short one begin the same way.
        expect(standingParts({ level: 1, skill: 0, onStand: 4, notes: 0 })).toEqual([
            "grade",
            "stand",
        ]);
        expect(standingParts({ level: 1, skill: 30, onStand: 0, notes: 0 })).toEqual([
            "grade",
            "skill",
        ]);
    });

    it("is not fooled by a negative or fractional figure", () => {
        // Nothing here should ever be below zero; if something upstream goes wrong, an
        // empty line is a better failure than "Grade -1".
        expect(standingParts({ level: -1, skill: -5, onStand: -2, notes: -3 })).toEqual([]);
        expect(standingParts({ ...nothing, notes: 0.4 })).toEqual(["not-graded", "notes"]);
    });
});
