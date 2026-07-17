// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { INTERVAL_IDS } from "../../core/theory";
import { intervalName, spanName } from "./theoryNames";

// The default locale is English, so the assertions read the English strings — the point
// is the mapping and the compound composition, not any one language's wording.

describe("intervalName", () => {
    it("names every interval the core knows", () => {
        for (const interval of INTERVAL_IDS) {
            expect(intervalName(interval)).toBeTruthy();
        }
    });

    it("names a specific interval in words", () => {
        expect(intervalName("perfect-fifth")).toBe("Perfect fifth");
    });
});

describe("spanName", () => {
    it("names a reach within the octave as the plain interval", () => {
        expect(spanName(0)).toBe("Unison");
        expect(spanName(9)).toBe("Major sixth");
        expect(spanName(12)).toBe("Octave");
    });

    // A hand that spans a tenth reaches a tenth, not a third — so a span, unlike an
    // interval heard in a quiz, must not fold the compound away.
    it("composes a wider reach from the octave and the remainder", () => {
        expect(spanName(14)).toBe("Octave + Major second");
        expect(spanName(16)).toBe("Octave + Major third");
        expect(spanName(21)).toBe("Octave + Major sixth");
    });

    it("reads a negative distance as the same size", () => {
        expect(spanName(-9)).toBe("Major sixth");
    });

    it("drops the gloss beyond two octaves, leaving the number to carry it", () => {
        expect(spanName(24)).toBeNull();
        expect(spanName(30)).toBeNull();
    });
});
