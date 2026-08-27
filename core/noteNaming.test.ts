// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { keyNameIn, noteSystemFor } from "./noteNaming";

const SLUGS = [
    "c",
    "csharp",
    "dflat",
    "d",
    "dsharp",
    "eflat",
    "e",
    "f",
    "fsharp",
    "gflat",
    "g",
    "gsharp",
    "aflat",
    "a",
    "asharp",
    "bflat",
    "b",
];

describe("noteSystemFor", () => {
    it("gives German its own system and everyone else letters", () => {
        expect(noteSystemFor("de")).toBe("german");
        for (const locale of ["en", "fr", "ja", "pl", "sv", "cs"]) {
            expect(noteSystemFor(locale)).toBe("letters");
        }
    });
});

describe("keyNameIn", () => {
    it("names the letter keys as they always were", () => {
        expect(keyNameIn("c", "letters")).toBe("C");
        expect(keyNameIn("fsharp", "letters")).toBe("F♯");
        expect(keyNameIn("eflat", "letters")).toBe("E♭");
        expect(keyNameIn("b", "letters")).toBe("B");
    });

    it("calls B natural H in German, and B flat B", () => {
        // The whole point. "B-Dur-Tonleiter" told a German student to play B flat when
        // the app meant B natural — the app stating the wrong note, in the one place a
        // beginner has no way to check it.
        expect(keyNameIn("b", "german")).toBe("H");
        expect(keyNameIn("bflat", "german")).toBe("B");
    });

    it("spells German accidentals as words", () => {
        expect(keyNameIn("csharp", "german")).toBe("Cis");
        expect(keyNameIn("fsharp", "german")).toBe("Fis");
        expect(keyNameIn("gsharp", "german")).toBe("Gis");
        expect(keyNameIn("dflat", "german")).toBe("Des");
        expect(keyNameIn("gflat", "german")).toBe("Ges");
    });

    it("uses the contractions a German musician writes, not the regular forms", () => {
        // Ees and Aes are what the rule would produce and nobody writes them.
        expect(keyNameIn("eflat", "german")).toBe("Es");
        expect(keyNameIn("aflat", "german")).toBe("As");
    });

    it("names every key Plinky can ask for, in both systems", () => {
        // A slug with no name would put a raw "BFLAT" in front of a reader.
        for (const slug of SLUGS) {
            for (const system of ["letters", "german"] as const) {
                const name = keyNameIn(slug, system);
                expect(name).not.toBe("");
                expect(name).toBe(name.trim());
                expect(name.toLowerCase()).not.toContain("flat");
                expect(name.toLowerCase()).not.toContain("sharp");
            }
        }
    });

    it("hands back something rather than nothing for a slug it does not know", () => {
        expect(keyNameIn("", "german")).toBe("");
        expect(keyNameIn("zebra", "german")).toBe("ZEBRA");
    });

    it("never gives two different keys the same German name", () => {
        // H and B are one letter apart in the two systems, which is exactly the sort of
        // collision that would reintroduce the bug from the other side.
        const names = SLUGS.map((slug) => keyNameIn(slug, "german"));
        const enharmonic = new Set([
            "Cis",
            "Des",
            "Dis",
            "Es",
            "Fis",
            "Ges",
            "Gis",
            "As",
            "Ais",
            "B",
        ]);
        const naturals = names.filter((name) => !enharmonic.has(name));
        expect(new Set(naturals).size).toBe(naturals.length);
    });
});
