// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { isPublicDomain } from "./publicDomain.mts";

describe("isPublicDomain", () => {
    it("admits well-known public-domain composers", () => {
        for (const composer of [
            "Johann Sebastian Bach",
            "J.S. Bach",
            "Wolfgang Amadeus Mozart",
            "Frédéric Chopin",
            "Arthur Sullivan",
            "John Dowland",
            "Turlough O'Carolan",
            "Antonio Vivaldi",
        ]) {
            expect(isPublicDomain(composer), composer).toBe(true);
        }
    });

    it("admits composers whose surname is diacritic-folded or continues the stem", () => {
        // The composer field carries accents inconsistently, and Slavic surnames often
        // continue a stem — both must still match.
        expect(isPublicDomain("Georg Friedrich Händel")).toBe(true);
        expect(isPublicDomain("Gabriel Fauré")).toBe(true);
        expect(isPublicDomain("Antonín Dvořák")).toBe(true);
        expect(isPublicDomain("Pyotr Ilyich Tchaikovsky")).toBe(true);
        expect(isPublicDomain("Sergei Rachmaninoff")).toBe(true);
        expect(isPublicDomain("Modest Mussorgsky")).toBe(true);
    });

    it("admits the vetted public-domain composers whose surnames are on the allowlist", () => {
        // All died on or before the life+70 cutoff; surnames distinctive enough not to
        // collide with any copyrighted act in the corpus.
        for (const composer of [
            "Béla Bartók", // 1945
            "Gustav Mahler", // 1911
            "Kurt Weill", // 1950
            "Carlos Gardel", // 1935
            "George Butterworth", // 1916
            "Johan Halvorsen", // 1935
            "Rabindranath Tagore", // 1941
            "Manuel M. Ponce", // 1948
            "Francesco Paolo Tosti", // 1916
            "Calixa Lavallée", // 1891
        ]) {
            expect(isPublicDomain(composer), composer).toBe(true);
        }
    });

    it("admits full-name public-domain composers whose bare surname is unsafe", () => {
        // Matched by full name so the common token never opens the door to a copyrighted
        // namesake (David Foster, b. 1949) or a too-common surname.
        expect(isPublicDomain("Stephen Foster")).toBe(true); // 1864
        expect(isPublicDomain("Adolphe Adam", "O Holy Night")).toBe(true); // 1856
        expect(isPublicDomain("David Foster", "The Prayer")).toBe(false);
    });

    it("admits a composer given a (birth–death) range on or before the cutoff", () => {
        expect(isPublicDomain("Carl Czerny (1791-1857)")).toBe(true);
        expect(isPublicDomain("Some Composer (1685–1750)")).toBe(true);
        // A death after the life+70 cutoff is not yet public domain.
        expect(isPublicDomain("Some Composer (1900-1980)")).toBe(false);
    });

    it("admits traditional / anonymous / folk works", () => {
        expect(isPublicDomain("Traditional", "Greensleeves")).toBe(true);
        expect(isPublicDomain("Anonymous")).toBe(true);
        expect(isPublicDomain("arr. Smith", "Traditional Irish Folk")).toBe(true);
    });

    it("rejects copyrighted acts wrongly tagged CC0 on PDMX", () => {
        for (const composer of [
            "Panic! At the Disco",
            "Billie Eilish",
            "Koji Kondo",
            "Toby Fox",
            "Hans Zimmer",
            "Burt Bacharach", // must not match the "bach" surname
            // Died 1957 — not life+70 public domain until 2028, so kept OFF the allowlist
            // despite being a canonical classical name.
            "Jean Sibelius",
            "Jean Sibelius (1865-1957)",
            // Copyrighted namesakes / co-writers a bare PD surname would wrongly admit,
            // which is why "gonzaga" and "waller" are kept off the allowlist.
            "Luiz Gonzaga", // d. 1989 — not the PD Chiquinha Gonzaga
            "Luiz Gonzaga e Humberto Teixeira", // "Asa Branca"
        ]) {
            expect(isPublicDomain(composer), composer).toBe(false);
        }
    });

    it("does not let a surname stem bleed into a title word", () => {
        // "bach" ⊄ "bachelor", "clementi" ⊄ "clementine": composer-name patterns read
        // the composer field only, and match complete surnames.
        expect(isPublicDomain("Panic! At the Disco", "Death of a Bachelor")).toBe(false);
        expect(isPublicDomain("Percy Montrose", "Oh My Darling Clementine")).toBe(false);
    });

    it("rejects an empty composer — no attribution to confirm", () => {
        expect(isPublicDomain("")).toBe(false);
        expect(isPublicDomain("   ")).toBe(false);
    });
});

describe("the copyrighted-works denylist beats the traditional label", () => {
    it("denies 20th-century works the corpora mislabel Traditional", () => {
        expect(isPublicDomain("Misc Traditional", "petit papa noel")).toBe(false);
        expect(isPublicDomain("Traditional", "you are my sunshine")).toBe(false);
        expect(isPublicDomain("Trad", "Tzena Tzena")).toBe(false);
    });

    it("keeps admitting genuinely traditional works", () => {
        expect(isPublicDomain("Traditional", "Greensleeves")).toBe(true);
    });
});

