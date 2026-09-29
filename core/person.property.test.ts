// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    canonicalComposer,
    canonicalPeople,
    composerCounts,
    nameFromSlug,
    personSlug,
    personSlugs,
} from "./person";

// Composer names as they arrive: from harvested corpora, from a player's own import, in
// half a dozen spellings and occasionally credited to two people at once. Every composer
// page in the catalogue is keyed off what these return, so what they must never do is
// answer differently the second time, or hand back something that is not a name.
//
// The names generated here include the ones that are not names at all — "constructor",
// "toString" — because a score really can be credited that way, and an object answers for
// those whether anybody put them in the alias table or not.

const HAZARDS = ["constructor", "toString", "__proto__", "valueOf", "hasOwnProperty"];

const arbName = fc.oneof(
    { weight: 3, arbitrary: fc.string({ minLength: 1, maxLength: 24 }) },
    { weight: 2, arbitrary: fc.constantFrom("Bach", "J. S. Bach", "Frédéric Chopin", "Satie") },
    { weight: 2, arbitrary: fc.constantFrom(...HAZARDS) },
    {
        weight: 1,
        arbitrary: fc.constantFrom(
            "Bellini/Chopin",
            "Joplin and Hayden",
            "Lemoine y Carulli",
            "Schumann & Brahms",
        ),
    },
);

describe("composer names, however they arrive", () => {
    it("settles on one spelling and stays there", () => {
        fc.assert(
            fc.property(arbName, (raw) => {
                const once = canonicalComposer(raw);

                expect(typeof once).toBe("string");
                expect(canonicalComposer(once)).toBe(once);
            }),
        );
    });

    it("hands back names rather than whatever an object answers for", () => {
        fc.assert(
            fc.property(arbName, (raw) => {
                const people = canonicalPeople(raw);

                expect(Array.isArray(people)).toBe(true);
                for (const person of people) {
                    expect(typeof person).toBe("string");
                    expect(person).not.toBe("");
                }
            }),
        );
    });

    it("splits a credit into people, each of which settles on its own spelling", () => {
        fc.assert(
            fc.property(arbName, (raw) => {
                const people = canonicalPeople(raw);

                for (const person of people) {
                    expect(canonicalPeople(person).length).toBeGreaterThanOrEqual(1);
                    expect(canonicalComposer(person)).toBe(person);
                }
            }),
        );
    });

    it("gives a slug that is safe in an address", () => {
        fc.assert(
            fc.property(arbName, (raw) => {
                const slug = personSlug(raw);

                expect(typeof slug).toBe("string");
                expect(slug).toMatch(/^[a-z0-9-]*$/);
            }),
        );
    });

    // A slug is an address, not a name, so the round trip runs through nameFromSlug. It
    // holds for names of the shape people have: a credit that is an attribution marker
    // rather than a person is empty by design, and one carrying a word the splitter reads
    // as "and" — including a bare middle initial E or Y, which is why "George E. Hill"
    // keeps its full stop — names two people rather than one.
    const arbPersonName = fc
        .array(
            fc
                .tuple(
                    fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
                    fc.stringMatching(/^[a-z]{2,8}$/),
                )
                .map(([initial, rest]) => initial + rest),
            { minLength: 2, maxLength: 3 },
        )
        .map((words) => words.join(" "));

    it("reads a slug back as a name that addresses the same person", () => {
        fc.assert(
            fc.property(arbPersonName, (name) => {
                const slug = personSlug(name);
                fc.pre(slug !== "");

                expect(personSlug(nameFromSlug(slug))).toBe(slug);
            }),
        );
    });

    it("gives one slug per person in a joint credit", () => {
        fc.assert(
            fc.property(arbName, (raw) => {
                const slugs = personSlugs(raw);
                const people = canonicalPeople(raw);

                expect(slugs.length).toBeLessThanOrEqual(people.length);
                for (const slug of slugs) {
                    expect(slug).toMatch(/^[a-z0-9-]+$/);
                }
                expect(new Set(slugs).size).toBe(slugs.length);
            }),
        );
    });

    it("counts every piece against somebody, and counts each of them once", () => {
        fc.assert(
            fc.property(fc.array(arbName, { maxLength: 20 }), (names) => {
                const counts = composerCounts(names.map((composer) => ({ composer })));

                const slugs = counts.map((one) => one.slug);
                expect(new Set(slugs).size).toBe(slugs.length);
                for (const one of counts) {
                    expect(one.pieces).toBeGreaterThan(0);
                    expect(typeof one.name).toBe("string");
                }
                // Nobody is counted for more pieces than there were.
                const total = counts.reduce((sum, one) => sum + one.pieces, 0);
                expect(total).toBeLessThanOrEqual(names.length * 3);
            }),
        );
    });
});
