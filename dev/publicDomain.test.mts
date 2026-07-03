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
