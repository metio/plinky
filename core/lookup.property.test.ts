// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { known, lookup, lookupOr } from "./lookup";

// The one guard between a string from outside and a table inside. Its whole job is the
// answer for a key the table does not hold, so that is what the laws are about — and
// the keys that used to get a different answer are the ordinary ones every object
// answers for.

const HAZARDS = [
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
    "__proto__",
    "__defineGetter__",
];

const arbTable = fc.dictionary(fc.stringMatching(/^[a-z]{1,6}$/), fc.integer(), {
    maxKeys: 6,
});

describe("reading a table by a key from outside", () => {
    it("answers with the fallback for anything the table does not hold", () => {
        fc.assert(
            fc.property(
                arbTable,
                fc.string({ maxLength: 12 }),
                fc.integer(),
                (table, key, fallback) => {
                    fc.pre(!Object.hasOwn(table, key));

                    expect(lookup(table, key, fallback)).toBe(fallback);
                    expect(lookupOr(table, key)).toBeNull();
                    expect(known(table, key)).toBe(false);
                },
            ),
        );
    });

    it("gives no key of Object's own a meaning it never had", () => {
        fc.assert(
            fc.property(
                arbTable,
                fc.constantFrom(...HAZARDS),
                fc.integer(),
                (table, key, fallback) => {
                    // The failure this exists to prevent: a truthy function where a number
                    // was promised, which `?? fallback` cannot catch and no type flags.
                    expect(lookup(table, key, fallback)).toBe(fallback);
                    expect(typeof lookup(table, key, fallback)).toBe("number");
                    expect(lookupOr(table, key)).toBeNull();
                    expect(known(table, key)).toBe(false);
                },
            ),
        );
    });

    it("hands back what the table holds, where it holds it", () => {
        fc.assert(
            fc.property(arbTable, fc.integer(), (table, fallback) => {
                for (const [key, value] of Object.entries(table)) {
                    expect(known(table, key)).toBe(true);
                    expect(lookup(table, key, fallback)).toBe(value);
                    expect(lookupOr(table, key)).toBe(value);
                }
            }),
        );
    });

    it("reads a key the table really holds, even one named after a prototype member", () => {
        fc.assert(
            fc.property(fc.constantFrom(...HAZARDS), fc.integer(), (key, value) => {
                // A table may legitimately hold such a key, and then it is its own value
                // that comes back — the guard asks the table, not the prototype.
                const table = Object.fromEntries([[key, value]]) as Record<string, number>;

                expect(lookup(table, key, value + 1)).toBe(value);
                expect(known(table, key)).toBe(true);
            }),
        );
    });
});
