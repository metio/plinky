// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    ERAS,
    HUB_GRADES,
    eraOf,
    erasOfPiece,
    erasOf,
    hubCollection,
    hubEra,
    hubGrade,
    piecesOfCollection,
    piecesOfEra,
    piecesOfGrade,
    sortPieces,
} from "./musicHubs";

describe("which era somebody belongs to", () => {
    it("places the composers whose era nobody argues about", () => {
        expect(eraOf(1685)).toBe("baroque"); // Bach, Handel, Scarlatti
        expect(eraOf(1756)).toBe("classical"); // Mozart
        expect(eraOf(1810)).toBe("romantic"); // Chopin, Schumann
        expect(eraOf(1873)).toBe("modern"); // Rachmaninoff
    });

    it("puts each boundary year in the later era", () => {
        expect(eraOf(1709)).toBe("baroque");
        expect(eraOf(1710)).toBe("classical");
        expect(eraOf(1799)).toBe("classical");
        expect(eraOf(1800)).toBe("romantic");
        expect(eraOf(1869)).toBe("romantic");
        expect(eraOf(1870)).toBe("modern");
    });

    it("places nobody it has no year for", () => {
        // A shelf of people whose dates are unknown is not an era, and quietly filing
        // them under the commonest one would say the catalogue knows something it does not.
        expect(eraOf(undefined)).toBeNull();
        expect(eraOf(Number.NaN)).toBeNull();
    });
});

describe("a hub's address", () => {
    it("answers for the grades the catalogue grades on", () => {
        expect(HUB_GRADES.map((grade) => hubGrade(String(grade)))).toEqual([...HUB_GRADES]);
    });

    it("answers for nothing else", () => {
        // One shelf, one address: "03" and "3.0" reaching grade three would put the same
        // list at three addresses competing with each other.
        for (const value of ["0", "9", "03", "3.0", "", " 3", "3 ", "one", "-3"]) {
            expect(hubGrade(value)).toBeNull();
        }
    });

    it("answers for the eras and nothing else", () => {
        expect(ERAS.map((era) => hubEra(era))).toEqual([...ERAS]);
        for (const value of ["", "Baroque", "renaissance", "constructor", "toString"]) {
            expect(hubEra(value)).toBeNull();
        }
    });
});

describe("the composers on an era's shelf", () => {
    it("groups them by the year they were born", () => {
        expect(
            erasOf({
                "js-bach": { born: 1685 },
                "wa-mozart": { born: 1756 },
                "f-chopin": { born: 1810 },
            }),
        ).toEqual({ "js-bach": "baroque", "wa-mozart": "classical", "f-chopin": "romantic" });
    });

    it("leaves out anybody with no year, rather than carrying them empty", () => {
        expect(erasOf({ anonymous: { about: "a traditional tune" } })).toEqual({});
    });
});

describe("which shelf a piece belongs on", () => {
    const eras = { "frederic-chopin": "romantic", "johann-sebastian-bach": "baroque" } as const;

    it("takes the era of whoever wrote it", () => {
        expect(erasOfPiece("Frédéric Chopin", eras)).toEqual(["romantic"]);
    });

    it("puts a piece credited to two people on both their shelves", () => {
        expect(erasOfPiece("Johann Sebastian Bach & Frédéric Chopin", eras)).toEqual([
            "baroque",
            "romantic",
        ]);
        expect(erasOfPiece("Johann Sebastian Bach & Someone Unplaced", eras)).toEqual(["baroque"]);
    });

    it("names an era once for two composers of it", () => {
        expect(erasOfPiece("Frédéric Chopin & Frédéric Chopin", eras).length).toBe(1);
    });

    it("places nothing credited to nobody it knows", () => {
        expect(erasOfPiece("Traditional", eras)).toEqual([]);
        expect(erasOfPiece("", eras)).toEqual([]);
    });

    it("does not answer for a name that is a property of every object", () => {
        // A composer credited "constructor" would otherwise inherit Object's, and every
        // piece by them would land on whichever era that resolved to.
        expect(erasOfPiece("constructor", eras)).toEqual([]);
    });
});

describe("a named work's shelf", () => {
    const pieces = [
        { id: "b", title: "Second", composer: "Bach", grade: 5 },
        { id: "a", title: "First", composer: "Bach", grade: 2 },
        { id: "z", title: "Elsewhere", composer: "Bach", grade: 1 },
    ];

    it("keeps the order the work itself gives, not the easiest first", () => {
        // A grade shelf is a pile to choose from; a book of studies is a sequence. Sorting
        // Bach's inventions by difficulty would be rewriting the book.
        expect(piecesOfCollection(pieces, ["b", "a"]).map((piece) => piece.id)).toEqual(["b", "a"]);
    });

    it("leaves out a piece the catalogue no longer holds", () => {
        expect(piecesOfCollection(pieces, ["a", "missing", "b"]).map((p) => p.id)).toEqual([
            "a",
            "b",
        ]);
    });

    it("answers for a work the catalogue names and nothing else", () => {
        expect(hubCollection("bach-inventions", ["bach-inventions"])).toBe("bach-inventions");
        expect(hubCollection("nonesuch", ["bach-inventions"])).toBeNull();
        expect(hubCollection("constructor", ["bach-inventions"])).toBeNull();
    });
});

describe("a shelf's own list", () => {
    const pieces = [
        { id: "c", title: "Zither", composer: "Frédéric Chopin", grade: 2 },
        { id: "a", title: "Aria", composer: "Johann Sebastian Bach", grade: 5 },
        { id: "b", title: "Ballad", composer: "Frédéric Chopin", grade: 2 },
        { id: "d", title: "Study", composer: "Nobody At All", grade: 5 },
    ];

    it("opens on what a visitor at that level can start with", () => {
        expect(sortPieces(pieces).map((piece) => piece.id)).toEqual(["b", "c", "a", "d"]);
    });

    it("holds one grade's pieces", () => {
        expect(piecesOfGrade(pieces, 2).map((piece) => piece.id)).toEqual(["b", "c"]);
        expect(piecesOfGrade(pieces, 7)).toEqual([]);
    });

    it("holds one era's pieces, whatever grade they are", () => {
        const eras = { "frederic-chopin": "romantic", "johann-sebastian-bach": "baroque" } as const;
        expect(piecesOfEra(pieces, "romantic", eras).map((piece) => piece.id)).toEqual(["b", "c"]);
        expect(piecesOfEra(pieces, "baroque", eras).map((piece) => piece.id)).toEqual(["a"]);
        expect(piecesOfEra(pieces, "modern", eras)).toEqual([]);
    });

    it("lists a piece once even when two manifests carry it", () => {
        // The id is a fingerprint of the notes, so the same music harvested twice arrives
        // twice under one id. A shelf naming it twice is a shelf a reader distrusts, and
        // it would also put the page's count above the one the edge writes.
        const twice = [
            ...pieces,
            { id: "a", title: "Aria", composer: "Johann Sebastian Bach", grade: 5 },
        ];
        expect(sortPieces(twice)).toHaveLength(pieces.length);
        expect(piecesOfGrade(twice, 5).map((piece) => piece.id)).toEqual(["a", "d"]);
    });

    it("leaves the list it was handed alone", () => {
        const order = pieces.map((piece) => piece.id);
        sortPieces(pieces);
        expect(pieces.map((piece) => piece.id)).toEqual(order);
    });
});
