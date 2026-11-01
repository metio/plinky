// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type Era,
    ERAS,
    eraOf,
    erasOfPiece,
    HUB_GRADES,
    hubCollection,
    hubEra,
    hubGrade,
    type HubPiece,
    piecesOfCollection,
    piecesOfEra,
    piecesOfGrade,
    sortPieces,
} from "./musicHubs";

// The shelves the catalogue is browsed through: a page per grade, per era, per named
// work. Each is a real address with a prerendered document, so what a segment is allowed
// to name decides whether a URL is a page or a 404 — and answering "/music/grade/03"
// with grade 3's pieces would put one shelf at several addresses, which is the kind of
// thing a crawler notices and a reader never does.

const arbPiece: fc.Arbitrary<HubPiece> = fc
    .tuple(
        fc.stringMatching(/^[a-z0-9]{1,6}$/),
        fc.stringMatching(/^[A-Za-z ]{1,12}$/),
        fc.constantFrom("Bach", "Chopin", "Satie", "Bellini/Chopin", "Traditional"),
        fc.option(fc.constantFrom(...HUB_GRADES), { nil: undefined }),
    )
    .map(([id, title, composer, grade]) =>
        grade === undefined ? { id, title, composer } : { id, title, composer, grade },
    );

const arbPieces = fc.array(arbPiece, { maxLength: 12 });

describe("what a shelf's address may name", () => {
    it("names a grade the catalogue has, and nothing that merely looks like one", () => {
        fc.assert(
            fc.property(fc.constantFrom(...HUB_GRADES), (grade) => {
                expect(hubGrade(String(grade))).toBe(grade);
            }),
        );
        fc.assert(
            fc.property(fc.string({ maxLength: 6 }), (value) => {
                fc.pre(!HUB_GRADES.some((grade) => String(grade) === value));

                // A padded or out-of-range segment is a 404 rather than a second
                // address for a shelf that already has one.
                expect(hubGrade(value)).toBeNull();
            }),
        );
        for (const near of ["03", "9", "0", "1.0", " 1", "1 ", "+1", "constructor", ""]) {
            expect(hubGrade(near)).toBeNull();
        }
    });

    it("names an era the catalogue sorts by, and nothing else", () => {
        fc.assert(
            fc.property(fc.constantFrom(...ERAS), (era) => {
                expect(hubEra(era)).toBe(era);
            }),
        );
        fc.assert(
            fc.property(fc.string({ maxLength: 10 }), (value) => {
                fc.pre(!(ERAS as readonly string[]).includes(value));

                expect(hubEra(value)).toBeNull();
            }),
        );
        for (const hazard of ["constructor", "toString", "__proto__", "Baroque"]) {
            expect(hubEra(hazard)).toBeNull();
        }
    });

    it("names a collection somebody chose, never one derived from a name", () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.stringMatching(/^[a-z-]{3,14}$/), { maxLength: 5 }),
                fc.string({ maxLength: 14 }),
                (known, value) => {
                    expect(hubCollection(value, known)).toBe(known.includes(value) ? value : null);
                },
            ),
        );
    });
});

describe("which era a composer belongs to", () => {
    it("never puts a later birth in an earlier era", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1400, max: 2020 }),
                fc.integer({ min: 1400, max: 2020 }),
                (earlier, later) => {
                    fc.pre(earlier <= later);
                    const first = eraOf(earlier);
                    const second = eraOf(later);
                    if (first === null || second === null) {
                        return;
                    }

                    // The bounds are read as "born before", so the ordering is the whole
                    // of what the boundaries mean.
                    expect(ERAS.indexOf(second)).toBeGreaterThanOrEqual(ERAS.indexOf(first));
                },
            ),
        );
    });

    it("places every composer it can, and says nothing about the rest", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1400, max: 2020 }), (born) => {
                expect(ERAS).toContain(eraOf(born));
            }),
        );
        // A page of pieces by people whose dates are unknown is not an era.
        for (const unknown of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(eraOf(unknown as number | undefined)).toBeNull();
        }
        // Every era is reachable, or one of the four shelves is a page nothing fills.
        expect(new Set(ERAS.map((era) => era))).toEqual(
            new Set([1685, 1756, 1810, 1950].map((born) => eraOf(born) as Era)),
        );
    });

    it("reads a composer's eras off the table and nowhere else", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("Bach", "Bellini/Chopin", "Traditional", "constructor"),
                (composer) => {
                    const eras = erasOfPiece(composer, {});

                    // An empty table places nobody. A bare lookup would answer for
                    // "constructor" with a function and put it on an era shelf.
                    expect(eras).toEqual([]);
                },
            ),
        );
        const both = erasOfPiece("Bellini/Chopin", {
            "vincenzo-bellini": "classical",
            "frederic-chopin": "romantic",
        });
        expect(both.length).toBe(new Set(both).size);
        for (const era of both) {
            expect(ERAS).toContain(era);
        }
    });
});

describe("the pieces on a shelf", () => {
    it("lists each piece once, easiest first and then by title", () => {
        fc.assert(
            fc.property(arbPieces, (pieces) => {
                const shelf = sortPieces(pieces);

                // A piece can be in two of the catalogue's manifests at once — the id is
                // a fingerprint of the notes — and a shelf that lists it twice is a
                // shelf a reader distrusts.
                const ids = shelf.map((piece) => piece.id);
                expect(new Set(ids).size).toBe(ids.length);
                expect(new Set(ids)).toEqual(new Set(pieces.map((piece) => piece.id)));
                shelf.forEach((piece, at) => {
                    const before = shelf[at - 1];
                    if (!before) {
                        return;
                    }
                    const order =
                        (before.grade ?? 0) - (piece.grade ?? 0) ||
                        before.title.localeCompare(piece.title);
                    expect(order).toBeLessThanOrEqual(0);
                });
            }),
        );
    });

    it("puts only that grade on a grade's shelf", () => {
        fc.assert(
            fc.property(arbPieces, fc.constantFrom(...HUB_GRADES), (pieces, grade) => {
                const shelf = piecesOfGrade(pieces, grade);

                for (const piece of shelf) {
                    expect(piece.grade).toBe(grade);
                }
                expect(shelf).toEqual(sortPieces(shelf));
            }),
        );
    });

    it("keeps a collection in the order the work itself gives", () => {
        fc.assert(
            fc.property(arbPieces, (pieces) => {
                const items = pieces.map((piece) => piece.id);

                const listed = piecesOfCollection(pieces, [...items, "missing"]);

                // A grade shelf is a pile to choose from; a collection is a sequence, and
                // reordering Bach's inventions by difficulty would be rewriting the book.
                expect(listed.map((piece) => piece.id)).toEqual(items);
                expect(piecesOfCollection(pieces, []).length).toBe(0);
            }),
        );
    });

    it("puts a composer's pieces on their own era's shelf", () => {
        fc.assert(
            fc.property(arbPieces, fc.constantFrom(...ERAS), (pieces, era) => {
                const eras: Record<string, Era> = {
                    "johann-sebastian-bach": "baroque",
                    "frederic-chopin": "romantic",
                    "erik-satie": "modern",
                };

                const shelf = piecesOfEra(pieces, era, eras);

                for (const piece of shelf) {
                    expect(erasOfPiece(piece.composer, eras)).toContain(era);
                }
                expect(shelf).toEqual(sortPieces(shelf));
            }),
        );
    });
});
