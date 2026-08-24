// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { canonicalComposer, nameFromSlug, peopleFrom, personFor, personSlug } from "./person";

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

    it("folds a misspelled credit onto the composer it meant", () => {
        // Each of these is one score in the catalogue, spelled a letter away from a
        // composer with dozens. Nothing in the string says it is wrong, so only the table
        // can merge them — and unmerged, each owned a page holding a single piece that
        // could not be reached from the real composer's.
        expect(canonicalComposer("CRAUDE DEBUSSY")).toBe("Claude Debussy");
        expect(canonicalComposer("Calude Debussy")).toBe("Claude Debussy");
        expect(canonicalComposer("Wolfgang Amedeus Mozart")).toBe("Wolfgang Amadeus Mozart");
        expect(canonicalComposer("Eric Satie")).toBe("Erik Satie");
        expect(canonicalComposer("George Frederic Handel")).toBe("George Frideric Handel");
        expect(canonicalComposer("Sergeï Rachmaninov")).toBe("Sergei Rachmaninoff");
        // Cleaned of its work number first, then folded.
        expect(canonicalComposer("Edward Grieg Op. 54 No.3")).toBe("Edvard Grieg");
        // A catalogue number the work-number stripping does not recognise.
        expect(canonicalComposer("Maurice Ravel M. 19")).toBe("Maurice Ravel");
    });

    it("gives a folded misspelling the same page as the name it folds to", () => {
        expect(personSlug("CRAUDE DEBUSSY")).toBe(personSlug("Claude Debussy"));
        expect(personSlug("Eric Satie")).toBe(personSlug("Erik Satie"));
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
        for (const marker of [
            "Trad.",
            "Traditional",
            "traditionnel",
            "anonymus",
            "Anon.",
            "Traditional — “Ah ! vous dirai-je, maman” (France, 1761)",
            "Irish Traditional music",
        ]) {
            expect(personSlug(marker)).toBe("");
        }
        // A person whose name merely contains the letters stays a person.
        expect(personSlug("Conrad Anonsen")).toBe("conrad-anonsen");
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

describe("credits the catalogue actually carries", () => {
    it("merges the abbreviated spellings onto one person", () => {
        for (const [variant, canonical] of [
            ["C. Czerny", "Carl Czerny"],
            ["CzernyC", "Carl Czerny"],
            ["A. Scriabin", "Alexander Scriabin"],
            ["J. Brahms", "Johannes Brahms"],
            ["L. van Beethoven", "Ludwig van Beethoven"],
            ["M.Ravel", "Maurice Ravel"],
            ["Georg Friedrich Händel", "George Frideric Handel"],
            ["Felix Mendelssohn-Bartholdy", "Felix Mendelssohn"],
            ["António Vivaldi", "Antonio Vivaldi"],
            ["Frédérick Chopin", "Frédéric Chopin"],
        ] as const) {
            expect(canonicalComposer(variant)).toBe(canonical);
            expect(personSlug(variant)).toBe(personSlug(canonical));
        }
    });

    it("drops a work number that was filed as part of the composer's name", () => {
        expect(canonicalComposer("A.Scriabin Op.11.No.1")).toBe("Alexander Scriabin");
        expect(canonicalComposer("Johann Friedrich Franz Burgmüller Opus 100.")).toBe(
            "Johann Friedrich Franz Burgmüller",
        );
    });

    it("decodes an entity a credit picked up from an HTML pipeline", () => {
        expect(
            canonicalComposer("Charlotte Alington Barnard [published as &quot;Claribel&quot;]"),
        ).toBe("Charlotte Alington Barnard");
    });

    it("gives a tradition no page of its own", () => {
        for (const credit of ["Gregorian chant", "Volkslied", "1860s English Sea Shanty"]) {
            expect(personSlug(credit)).toBe("");
        }
    });

    it("strips the full stop a credit line left behind", () => {
        expect(canonicalComposer("John Philip Sousa.")).toBe("John Philip Sousa");
    });
});

describe("credits whose work number comes first", () => {
    it("keeps the composer instead of deleting them", () => {
        // Stripping "Op … " to the end of the string erased the whole credit when the
        // work number led it, leaving three real pieces attributed to nobody.
        expect(canonicalComposer("Op 39, No. 15 Johannes Brahms")).toBe("Johannes Brahms");
        expect(canonicalComposer("No.1. F. Chopin. Op.6")).toBe("Frédéric Chopin");
        expect(canonicalComposer("Opus 36 No. 1 M. Clementi")).toBe("M. Clementi");
    });

    it("still drops a work number that trails the name", () => {
        expect(canonicalComposer("Johann Friedrich Franz Burgmüller Opus 100.")).toBe(
            "Johann Friedrich Franz Burgmüller",
        );
    });

    it("leaves a name with no work number in it untouched", () => {
        for (const name of ["Johann Sebastian Bach", "Kurt Weill", "Turlough O'Carolan"]) {
            expect(canonicalComposer(name)).toBe(name);
        }
    });
});

describe("an arrangement's aside is not a claim about who wrote it", () => {
    it("keeps the arranger's page when the aside names a tradition", () => {
        // The tradition filter used to run on the raw credit, so this piece — BY
        // Burleigh — was handed to nobody by the word "Spiritual" inside his aside.
        const credit = "Harry Thacker Burleigh (arranged from a traditional Negro Spiritual)";
        expect(canonicalComposer(credit)).toBe("Harry Thacker Burleigh");
        expect(personSlug(credit)).toBe(personSlug("Harry Thacker Burleigh"));
    });

    it("still gives a tradition no page of its own", () => {
        for (const credit of ["Gregorian chant", "Volkslied", "Traditional", "Anonymous"]) {
            expect(personSlug(credit)).toBe("");
        }
    });
});

describe("nameFromSlug", () => {
    it("reads a slug back as words, for a composer the catalogue credits nobody by", () => {
        expect(nameFromSlug("clara-schumann")).toBe("Clara Schumann");
        expect(nameFromSlug("bach")).toBe("Bach");
    });

    it("survives the shapes a hand-typed URL arrives in", () => {
        expect(nameFromSlug("")).toBe("");
        expect(nameFromSlug("-")).toBe("");
        expect(nameFromSlug("--erik--satie--")).toBe("Erik Satie");
    });

    it("round-trips a slug this very module made, up to the diacritics it dropped", () => {
        // personSlug strips accents and case, so the name cannot come back whole. What
        // must come back is the word boundaries: a page title of "Faure" is a spelling a
        // reader forgives, "faure" is not.
        expect(nameFromSlug(personSlug("Gabriel Faur\u00e9"))).toBe("Gabriel Faure");
    });
});

describe("credits that are notes to self", () => {
    it("drops a hedge from a tradition marker", () => {
        // One harvested score credits "Traditional I think" — a thought somebody typed into
        // the composer field. Unlike the dated and catalogue-numbered credits around it,
        // nothing reduced it, so it reached the piece's page verbatim.
        expect(canonicalComposer("Traditional I think")).toBe("Traditional");
        expect(personSlug("Traditional I think")).toBe("");
    });

    it("leaves a genuinely enriched attribution alone", () => {
        // "Traditional — Irish" says something true about the piece. Only the hedge goes.
        expect(canonicalComposer("Traditional — Irish, 1761")).toBe("Traditional — Irish");
    });
});
