// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { digitOfKey } from "./keyMap";

const digit = fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9");
const code = fc.oneof(
    digit.map((d) => `Digit${d}`),
    digit.map((d) => `Numpad${d}`),
    fc.constantFrom("KeyQ", "KeyA", "Space", "Enter", "NumpadAdd", "Minus", ""),
);

describe("digitOfKey (properties)", () => {
    it("is the typed digit whenever the key types one, whatever key it sits on", () => {
        fc.assert(fc.property(digit, code, (key, where) => digitOfKey(key, where) === key));
    });

    it("is a single digit or nothing", () => {
        fc.assert(
            fc.property(fc.string(), code, (key, where) => {
                const read = digitOfKey(key, where);
                expect(read === null || /^[0-9]$/.test(read)).toBe(true);
            }),
        );
    });

    it("reads a key that types no digit by its place alone", () => {
        const notADigit = fc.string().filter((key) => !/^[0-9]$/.test(key));
        fc.assert(
            fc.property(notADigit, code, (key, where) => {
                const place = /^(?:Digit|Numpad)([0-9])$/.exec(where)?.[1] ?? null;
                expect(digitOfKey(key, where)).toBe(place);
            }),
        );
    });
});
