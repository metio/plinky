// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { secondsFigure } from "./seconds";

const LOCALES = ["en", "de", "fr", "pl", "ru", "ja", "el", "sq"];

describe("secondsFigure", () => {
    it("gives milliseconds as seconds to one decimal place", () => {
        expect(secondsFigure(1400, "en")).toBe("1.4");
        expect(secondsFigure(0, "en")).toBe("0.0");
        expect(secondsFigure(12040, "en")).toBe("12.0");
    });

    it("uses the locale's decimal separator", () => {
        expect(secondsFigure(1400, "de")).toBe("1,4");
        expect(secondsFigure(1400, "pl")).toBe("1,4");
        expect(secondsFigure(1400, "zh")).toBe("1.4");
    });

    it("never groups thousands, whose separator in German reads as a decimal point", () => {
        expect(secondsFigure(1_234_000, "en")).toBe("1234.0");
        expect(secondsFigure(1_234_000, "de")).toBe("1234,0");
        expect(secondsFigure(12_345_600, "fr")).toBe("12345,6");
    });

    it("writes a figure with one separator and nothing else between its digits", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 100_000_000 }),
                fc.constantFrom(...LOCALES),
                (ms, locale) => {
                    expect(secondsFigure(ms, locale)).toMatch(/^\d+[.,]\d$/);
                },
            ),
        );
    });

    it("says the same number as toFixed, in whatever the locale writes digits with", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 100_000_000 }),
                fc.constantFrom(...LOCALES),
                (ms, locale) => {
                    const digits = (text: string) => text.replace(/\D/g, "");
                    expect(digits(secondsFigure(ms, locale))).toBe(digits((ms / 1000).toFixed(1)));
                },
            ),
        );
    });
});
