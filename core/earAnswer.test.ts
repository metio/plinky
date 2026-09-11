// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { digitFor, optionForDigit, optionVerdict } from "./earAnswer";

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

describe("digitFor", () => {
    it("gives a plain scale degree its own digit", () => {
        for (const degree of ["1", "2", "3", "4", "5", "6", "7"]) {
            expect(digitFor(degree)).toBe(degree);
        }
    });

    it("gives a chromatic degree no digit", () => {
        for (const degree of ["♭2", "♭3", "♯4", "♭6", "♭7"]) {
            expect(digitFor(degree)).toBeNull();
        }
    });

    it("gives a Roman numeral the digit of the degree it stands on", () => {
        expect(digitFor("I")).toBe("1");
        expect(digitFor("ii")).toBe("2");
        expect(digitFor("iii")).toBe("3");
        expect(digitFor("IV")).toBe("4");
        expect(digitFor("V")).toBe("5");
        expect(digitFor("vi")).toBe("6");
        expect(digitFor("vii°")).toBe("7");
    });

    it("reads a numeral whatever its case or quality mark", () => {
        expect(digitFor("iv")).toBe("4");
        expect(digitFor("VII")).toBe("7");
        expect(digitFor("V7")).toBe("5");
        expect(digitFor("viiø7")).toBe("7");
        expect(digitFor("III+")).toBe("3");
    });

    it("never reads a flattened or sharpened numeral as a diatonic one", () => {
        expect(digitFor("♭VII")).toBeNull();
        expect(digitFor("bVI")).toBeNull();
        expect(digitFor("♯iv")).toBeNull();
        expect(digitFor("#IV")).toBeNull();
    });

    it("gives no digit to a name, a number past seven, or a non-numeral", () => {
        expect(digitFor("major")).toBeNull();
        expect(digitFor("perfect-fifth")).toBeNull();
        expect(digitFor("8")).toBeNull();
        expect(digitFor("0")).toBeNull();
        expect(digitFor("viii")).toBeNull();
        expect(digitFor("Vsus")).toBeNull();
        expect(digitFor("")).toBeNull();
    });
});

describe("optionForDigit", () => {
    it("answers a scale-degree question with the degree the key names", () => {
        expect(optionForDigit("3", ["1", "3", "5"])).toBe("3");
    });

    it("answers with the plain degree when a chromatic one is on offer too", () => {
        expect(optionForDigit("3", ["1", "♭3", "3", "5"])).toBe("3");
        expect(optionForDigit("2", ["1", "♭2", "3"])).toBeNull();
    });

    it("answers a progression with the numeral on that degree", () => {
        expect(optionForDigit("4", ["I", "IV", "V"])).toBe("IV");
        expect(optionForDigit("7", ["I", "vii°"])).toBe("vii°");
    });

    it("answers with nothing for a key the question has no use for", () => {
        expect(optionForDigit("8", ["1", "3", "5"])).toBeNull();
        expect(optionForDigit("2", ["1", "3", "5"])).toBeNull();
        expect(optionForDigit("q", ["1", "3", "5"])).toBeNull();
        expect(optionForDigit("1", ["major", "minor"])).toBeNull();
    });
});
