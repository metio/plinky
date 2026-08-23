// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { LEARN_PICK_HREF, type LearnPickId, learnPick } from "./learnPick";

const settled = { keyboardMet: true, placementTaken: true, courseDone: false };

describe("learnPick", () => {
    it("offers the keyboard before anything else to someone who has never found middle C", () => {
        expect(
            learnPick({ keyboardMet: false, placementTaken: false, courseDone: false, day: 3 }),
        ).toBe("basics");
        // Still first even for a reader the test has already placed: the tour is the
        // one step that assumes nothing at all.
        expect(
            learnPick({ keyboardMet: false, placementTaken: true, courseDone: false, day: 3 }),
        ).toBe("basics");
    });

    it("offers the level test once the keyboard is met", () => {
        expect(
            learnPick({ keyboardMet: true, placementTaken: false, courseDone: false, day: 3 }),
        ).toBe("placement");
    });

    it("rotates the four references once both one-off steps are behind you", () => {
        const week = [0, 1, 2, 3, 4, 5].map((day) => learnPick({ ...settled, day }));
        expect(week).toEqual(["theory", "glossary", "methods", "tools", "theory", "glossary"]);
    });

    it("stops offering the course once there is nothing left of it", () => {
        const week = [0, 1, 2, 3].map((day) => learnPick({ ...settled, courseDone: true, day }));
        expect(week).toEqual(["glossary", "methods", "tools", "glossary"]);
        expect(week).not.toContain("theory");
    });

    it("holds still through a day and moves on the next one", () => {
        expect(learnPick({ ...settled, day: 42 })).toBe(learnPick({ ...settled, day: 42 }));
        expect(learnPick({ ...settled, day: 42 })).not.toBe(learnPick({ ...settled, day: 43 }));
    });

    it("still lands on a real pick for a day number out of the ordinary", () => {
        for (const day of [-1, -7, 0.5, Number.MAX_SAFE_INTEGER]) {
            const pick = learnPick({ ...settled, day });
            expect(LEARN_PICK_HREF[pick]).toBeTruthy();
        }
    });

    it("gives every pick somewhere to go", () => {
        const ids: LearnPickId[] = [
            "basics",
            "placement",
            "theory",
            "glossary",
            "methods",
            "tools",
        ];
        for (const id of ids) {
            expect(LEARN_PICK_HREF[id]).toMatch(/^\/[a-z]+$/);
        }
    });
});
