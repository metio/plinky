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

    it("says a whole number of tenths exactly, in whatever the locale writes digits with", () => {
        // A duration of whole tenths has one right figure and no rounding in it, so the digits
        // written are the tenths themselves, whichever separator stands between them.
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 1_000_000 }),
                fc.constantFrom(...LOCALES),
                (tenths, locale) => {
                    const digits = secondsFigure(tenths * 100, locale).replace(/\D/g, "");
                    expect(digits).toBe(String(tenths).padStart(2, "0"));
                },
            ),
        );
    });

    it("never writes a figure more than half a tenth from the duration", () => {
        // Holds whichever way a duration ending in exactly half a tenth is rounded, so it pins
        // the figure's nearness without pinning how an engine breaks a tie.
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 100_000_000 }),
                fc.constantFrom(...LOCALES),
                (ms, locale) => {
                    const tenths = Number(secondsFigure(ms, locale).replace(/\D/g, ""));
                    expect(Math.abs(tenths * 100 - ms)).toBeLessThanOrEqual(50);
                },
            ),
        );
    });

    it("rounds a duration ending in half a tenth up, as the decimal it is", () => {
        // 1608.35 s is held as the binary double 1608.3499…, which toFixed rounds down to
        // 1608.3. The figure rounds the decimal the duration actually is.
        expect(secondsFigure(1_608_350, "en")).toBe("1608.4");
        expect(secondsFigure(1_608_350, "de")).toBe("1608,4");
    });
});
