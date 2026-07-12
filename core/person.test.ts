// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { canonicalComposer, peopleFrom, personFor, personSlug } from "./person";

// Spellings lifted verbatim from the shipped manifest — the whole point of the
// canonicalization is that these real variants land on one name.
const BACH_VARIANTS = [
    "Johann Sebastian Bach",
    "Johann Sebastian BACH",
    "Johann Sebastian Bach(1685 - 1750)",
    "Johann Sebastian Bach (1685 - 1750)",
    "Johann Sebastian Bach(16851750)",
    "J. S. Bach",
    "J.S. Bach",
    "J. S. Bach(1685-1750)",
];

describe("canonicalComposer", () => {
    it("lands every real-world Bach variant on the one name", () => {
        for (const variant of BACH_VARIANTS) {
            expect(canonicalComposer(variant)).toBe("Johann Sebastian Bach");
        }
    });

    it("strips parenthesized asides and bare trailing dates", () => {
        expect(canonicalComposer("Erik Satie (1866 1925)")).toBe("Erik Satie");
        expect(canonicalComposer("Giuseppe Verdi (1813-1901)")).toBe("Giuseppe Verdi");
        expect(canonicalComposer("Maurice Ravel(1875-1937)")).toBe("Maurice Ravel");
        expect(
            canonicalComposer("Johanna Kinkel (originally published under the name J. Mathieux)"),
        ).toBe("Johanna Kinkel");
    });

    it("flips Last, First", () => {
        expect(canonicalComposer("Bach, Johann Sebastian")).toBe("Johann Sebastian Bach");
    });

    it("merges the traditional and anonymous markers", () => {
        for (const variant of ["Trad.", "trad.", "Traditional", "TRADITIONAL", "Traditionnel"]) {
            expect(canonicalComposer(variant)).toBe("Traditional");
        }
        expect(canonicalComposer("anonymus")).toBe("Anonymous");
    });

    it("keeps an unknown name as its cleaned self and empty as empty", () => {
        expect(canonicalComposer("Josephine Lang")).toBe("Josephine Lang");
        expect(canonicalComposer("")).toBe("");
    });
});

describe("personSlug", () => {
    it("is stable across variants and strips diacritics", () => {
        expect(personSlug("J.S. Bach")).toBe("johann-sebastian-bach");
        expect(personSlug("Frédéric Chopin")).toBe("frederic-chopin");
        expect(personSlug("Antonín Dvořák")).toBe("antonin-dvorak");
        expect(personSlug("Turlough O'Carolan (1670-1738)")).toBe("turlough-o-carolan");
    });

    it("is empty for an unusable composer", () => {
        expect(personSlug("")).toBe("");
        expect(personSlug("  ")).toBe("");
    });

    it("refuses to make a person out of an attribution marker", () => {
        // "Traditional" and "Anonymous" normalize for display but are not
        // people: no slug, so no link and no page.
        for (const marker of ["Trad.", "Traditional", "traditionnel", "anonymus", "Anon."]) {
            expect(personSlug(marker)).toBe("");
        }
    });
});

describe("peopleFrom / personFor", () => {
    const pieces = [
        { id: "1", title: "Menuet", composer: "J. S. Bach", grade: 2 },
        { id: "2", title: "Air", composer: "Johann Sebastian Bach (1685 - 1750)", grade: 1 },
        { id: "3", title: "Gymnopédie", composer: "Erik Satie (1866-1925)", grade: 3 },
        { id: "4", title: "Untitled", composer: "" },
    ];

    it("groups variants under one person, most pieces first", () => {
        const people = peopleFrom(pieces);
        expect(people.map((person) => person.slug)).toEqual([
            "johann-sebastian-bach",
            "erik-satie",
        ]);
        expect(people[0]?.name).toBe("Johann Sebastian Bach");
        expect(people[0]?.pieces.map((piece) => piece.id)).toEqual(["2", "1"]);
    });

    it("drops pieces without a composer instead of inventing a page", () => {
        expect(peopleFrom(pieces).flatMap((person) => person.pieces)).toHaveLength(3);
    });

    it("finds one person by slug, or null", () => {
        expect(personFor(pieces, "erik-satie")?.pieces).toHaveLength(1);
        expect(personFor(pieces, "nobody-here")).toBeNull();
    });
});
