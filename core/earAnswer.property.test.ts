// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { digitFor, optionForDigit } from "./earAnswer";
import { PROGRESSION_LEVELS, SCALE_DEGREE_LEVELS } from "./earExercise";
import { CHORD_DEGREES, CHROMATIC_DEGREES, DIATONIC_DEGREES } from "./theory";

const KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "q", "z", " "];
const OPTIONS = [...new Set([...CHROMATIC_DEGREES, ...CHORD_DEGREES, "major", "V7", "♭VII"])];

const anyOptions = fc.uniqueArray(fc.constantFrom(...OPTIONS), { minLength: 0, maxLength: 12 });

describe("digit answers (properties)", () => {
    it("never answers with a chromatic degree", () => {
        const chromatic = CHROMATIC_DEGREES.filter((degree) => !DIATONIC_DEGREES.includes(degree));
        fc.assert(
            fc.property(fc.constantFrom(...KEYS), anyOptions, (key, options) => {
                const picked = optionForDigit(key, options);
                expect(picked === null || !chromatic.includes(picked as never)).toBe(true);
            }),
        );
    });

    it("reaches every plain degree on offer by its own digit", () => {
        fc.assert(
            fc.property(anyOptions, (options) => {
                for (const degree of DIATONIC_DEGREES) {
                    if (options.includes(degree)) {
                        // A numeral on the same degree could share the key; a real
                        // question never offers both, and the degree comes first here
                        // only when it is listed first.
                        const first = options.find((option) => digitFor(option) === degree);
                        expect(optionForDigit(degree, options)).toBe(first);
                    }
                }
            }),
        );
    });

    it("answers only with an option the question offers, and only by that option's digit", () => {
        fc.assert(
            fc.property(fc.constantFrom(...KEYS), anyOptions, (key, options) => {
                const picked = optionForDigit(key, options);
                if (picked !== null) {
                    expect(options).toContain(picked);
                    expect(digitFor(picked)).toBe(key);
                }
            }),
        );
    });

    it("reaches every option of every real level by its digit, each by a different key", () => {
        for (const level of [...SCALE_DEGREE_LEVELS, ...PROGRESSION_LEVELS]) {
            const digits = level.map(digitFor).filter((digit) => digit !== null);
            expect(new Set(digits).size).toBe(digits.length);
            for (const option of level) {
                const digit = digitFor(option);
                if (digit !== null) {
                    expect(optionForDigit(digit, level)).toBe(option);
                }
            }
        }
    });

    it("gives every diatonic chord a digit, so no progression key is unreachable", () => {
        for (const degree of CHORD_DEGREES) {
            expect(digitFor(degree)).not.toBeNull();
        }
    });
});
