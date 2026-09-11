// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { keyNameIn, minorKeyTextIn, noteSystemFor, noteTextIn, spokenKeyIn } from "./noteNaming";
import { NOTE_TEXT, type NoteNameId } from "./theory";

const NOTE_IDS = Object.keys(NOTE_TEXT) as NoteNameId[];

describe("noteTextIn", () => {
    it("writes every spelled note exactly as the letter table does, in letters", () => {
        for (const id of NOTE_IDS) {
            expect(noteTextIn(id, "letters")).toBe(NOTE_TEXT[id]);
        }
    });

    it("calls B natural H in German, B flat B, and spells the rest as words", () => {
        expect(noteTextIn("b", "german")).toBe("H");
        expect(noteTextIn("b-flat", "german")).toBe("B");
        expect(noteTextIn("f-sharp", "german")).toBe("Fis");
        expect(noteTextIn("c-sharp", "german")).toBe("Cis");
        expect(noteTextIn("e-flat", "german")).toBe("Es");
        expect(noteTextIn("a-flat", "german")).toBe("As");
        expect(noteTextIn("d-flat", "german")).toBe("Des");
    });

    it("spells the signature-only names a key at the circle's cut needs", () => {
        expect(noteTextIn("e-sharp", "german")).toBe("Eis");
        expect(noteTextIn("b-sharp", "german")).toBe("His");
        expect(noteTextIn("c-flat", "german")).toBe("Ces");
        expect(noteTextIn("f-flat", "german")).toBe("Fes");
    });

    it("gives every spelled note its own German name, with no sign left in it", () => {
        const names = NOTE_IDS.map((id) => noteTextIn(id, "german"));
        expect(new Set(names).size).toBe(names.length);
        for (const name of names) {
            expect(name).not.toMatch(/[♯♭]/);
        }
    });
});

describe("spokenKeyIn", () => {
    it("names a black key from the white key below it and asks for the sharp word", () => {
        expect(spokenKeyIn(61, "letters")).toEqual({ name: "C", sharp: true, octave: 4 });
        expect(spokenKeyIn(70, "letters")).toEqual({ name: "A", sharp: true, octave: 4 });
    });

    it("spaces nothing onto a white key", () => {
        expect(spokenKeyIn(60, "letters")).toEqual({ name: "C", sharp: false, octave: 4 });
        expect(spokenKeyIn(59, "letters")).toEqual({ name: "B", sharp: false, octave: 3 });
    });

    it("spells the sharp into a German name and calls B natural H", () => {
        expect(spokenKeyIn(61, "german")).toEqual({ name: "Cis", sharp: false, octave: 4 });
        expect(spokenKeyIn(70, "german")).toEqual({ name: "Ais", sharp: false, octave: 4 });
        expect(spokenKeyIn(59, "german")).toEqual({ name: "H", sharp: false, octave: 3 });
    });

    it("numbers the octaves the way a piano is labelled, middle C in the fourth", () => {
        expect(spokenKeyIn(21, "letters")).toEqual({ name: "A", sharp: false, octave: 0 });
        expect(spokenKeyIn(108, "letters")).toEqual({ name: "C", sharp: false, octave: 8 });
    });
});

describe("minorKeyTextIn", () => {
    it("writes a German minor key's tonic in lower case", () => {
        expect(minorKeyTextIn("b", "german")).toBe("h");
        expect(minorKeyTextIn("f-sharp", "german")).toBe("fis");
        expect(minorKeyTextIn("e-flat", "german")).toBe("es");
    });

    it("leaves a letter name as it is", () => {
        for (const id of NOTE_IDS) {
            expect(minorKeyTextIn(id, "letters")).toBe(NOTE_TEXT[id]);
        }
    });
});

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
