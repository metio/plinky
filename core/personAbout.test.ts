// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { aboutFor, aboutLine, lifespan, sameAsFor } from "./personAbout";

const WORDS = { born: (year: number) => `born ${year}`, died: (year: number) => `died ${year}` };

describe("aboutFor", () => {
    const people = { "frederic-chopin": { about: "Polish composer", born: 1810 } };

    it("answers for a composer the file holds", () => {
        expect(aboutFor(people, "frederic-chopin")?.born).toBe(1810);
    });

    it("answers for nobody else, prototype names included", () => {
        expect(aboutFor(people, "nobody")).toBeNull();
        // A bare lookup would answer with Object's own function here.
        expect(aboutFor(people, "constructor")).toBeNull();
        expect(aboutFor(people, "toString")).toBeNull();
    });
});

describe("lifespan", () => {
    it("sets a full life as a range, with an en dash", () => {
        expect(lifespan({ born: 1810, died: 1849 }, WORDS)).toBe("1810–1849");
    });

    it("names the one year it knows", () => {
        expect(lifespan({ born: 1935 }, WORDS)).toBe("born 1935");
        expect(lifespan({ died: 1849 }, WORDS)).toBe("died 1849");
        expect(lifespan({}, WORDS)).toBe("");
    });
});

describe("aboutLine", () => {
    it("puts the years after what the person was", () => {
        expect(aboutLine({ about: "Polish composer", born: 1810, died: 1849 }, WORDS)).toBe(
            "Polish composer (1810–1849)",
        );
    });

    it("prints whichever half it has, and nothing for neither", () => {
        expect(aboutLine({ about: "Polish composer" }, WORDS)).toBe("Polish composer");
        expect(aboutLine({ born: 1810, died: 1849 }, WORDS)).toBe("1810–1849");
        expect(aboutLine({}, WORDS)).toBe("");
    });
});

describe("sameAsFor", () => {
    it("names the records this page is the same person as", () => {
        expect(
            sameAsFor({
                id: "Q1268",
                wikipedia: "https://en.wikipedia.org/wiki/Fr%C3%A9d%C3%A9ric_Chopin",
            }),
        ).toEqual([
            "https://www.wikidata.org/wiki/Q1268",
            "https://en.wikipedia.org/wiki/Fr%C3%A9d%C3%A9ric_Chopin",
        ]);
        expect(sameAsFor({})).toEqual([]);
    });
});
