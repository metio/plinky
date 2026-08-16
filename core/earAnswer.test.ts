// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { optionVerdict } from "./earAnswer";

describe("optionVerdict", () => {
    it("marks nothing at all while the round is unanswered", () => {
        // Every option is still askable, so none of them may wear a colour.
        expect(optionVerdict("major-third", null, null)).toBeNull();
        expect(optionVerdict("perfect-fifth", null, "perfect-fifth")).toBeNull();
    });

    it("marks the right answer right, whether or not it was the one chosen", () => {
        expect(optionVerdict("perfect-fifth", "perfect-fifth", "perfect-fifth")).toBe("correct");
        expect(optionVerdict("perfect-fifth", "perfect-fifth", "major-third")).toBe("correct");
    });

    it("reddens only the option the player actually chose", () => {
        // The rule worth pinning: a settled round leaves every other option alone. A
        // wall of red would tell a player they got things wrong that they never picked.
        expect(optionVerdict("major-third", "perfect-fifth", "major-third")).toBe("wrong");
        expect(optionVerdict("octave", "perfect-fifth", "major-third")).toBeNull();
        expect(optionVerdict("major-second", "perfect-fifth", null)).toBeNull();
    });

    it("works on whatever a surface answers with", () => {
        // Keyboards answer with note names, ladders with intervals, grids with
        // qualities; the verdict is the same decision in all of them.
        expect(optionVerdict(7, 7, 3)).toBe("correct");
        expect(optionVerdict(3, 7, 3)).toBe("wrong");
    });
});

