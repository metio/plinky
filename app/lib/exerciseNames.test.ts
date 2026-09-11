// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it } from "vitest";
import { EXERCISE_TILES, type ExerciseConfig, exerciseTitle } from "../../core/exerciseGen";
import { type NoteLabels, type NoteLetters, namingFor } from "../../core/noteNaming";
import { m } from "../paraglide/messages.js";
import { baseLocale, type Locale, overwriteGetLocale } from "../paraglide/runtime.js";
import { exerciseName } from "./exerciseNames";

afterEach(() => overwriteGetLocale(() => baseLocale));

const base: ExerciseConfig = {
    type: "major-scale",
    key: "c",
    octaves: 1,
    hands: "right",
    inversion: 0,
    interval: "single",
};

const LETTERS = namingFor("all", "en");

describe("exerciseName", () => {
    it("names a scale with the key inside the phrase, not bolted onto it", () => {
        expect(exerciseName(base, LETTERS)).toBe(m.exercise_title_major_scale({ key: "C" }));
    });

    it("adds the forms that make this one different", () => {
        expect(exerciseName({ ...base, octaves: 2, hands: "both" }, LETTERS)).toBe(
            `${m.exercise_title_major_scale({ key: "C" })} · ${m.exercise_form_two_octaves()}, ${m.exercise_form_both_hands()}`,
        );
    });

    it("says nothing about the plain form", () => {
        expect(exerciseName(base, LETTERS)).not.toContain("·");
    });

    it("has a translated name for every exercise the app can generate", () => {
        // A missing entry would fall through to undefined and title a piece "undefined";
        // the tiles are the full set of kinds the library and the arcade can produce.
        for (const tile of EXERCISE_TILES) {
            const name = exerciseName(tile, LETTERS);
            expect(name.length).toBeGreaterThan(0);
            expect(name).not.toContain("undefined");
        }
    });

    it("carries the key spelling core works out, sharps and flats included", () => {
        expect(exerciseName({ ...base, key: "eflat" }, LETTERS)).toContain("E♭");
        expect(exerciseName({ ...base, key: "fsharp" }, LETTERS)).toContain("F♯");
    });

    it("is not the English the manifest was built with", () => {
        // en is the test locale, so the two agree here — what this pins is that the app
        // asks the message catalogue rather than reusing the score's baked-in title.
        // Every other locale gets its own wording from the same call.
        const config: ExerciseConfig = { ...base, type: "dom7-arpeggio", octaves: 2 };
        expect(exerciseName(config, LETTERS)).toBe(
            `${m.exercise_title_dom7_arpeggio({ key: "C" })} · ${m.exercise_form_two_octaves()}`,
        );
        expect(exerciseTitle(config)).toBe("C dominant 7th arpeggio · 2 octaves");
    });

    describe("naming the key the way the player's keys do", () => {
        // German notation calls B natural H and reserves B for B flat, so naming keys with
        // English letters did not read oddly to a German student — it told them to play a
        // different scale, in the one place a beginner has no way to check it.
        const named = (
            config: Partial<ExerciseConfig>,
            locale: Locale,
            labels?: NoteLabels,
            letters: NoteLetters = "auto",
        ) => {
            overwriteGetLocale(() => locale);
            const naming = namingFor(
                labels ?? (locale === "fr" ? "solfege" : "all"),
                locale,
                letters,
            );
            return exerciseName({ ...base, ...config }, naming);
        };

        it("calls B natural H in German", () => {
            expect(named({ key: "b" }, "de")).toBe(m.exercise_title_major_scale({ key: "H" }));
        });

        it("calls B flat B in German, which is what B means there", () => {
            expect(named({ key: "bflat" }, "de")).toBe(m.exercise_title_major_scale({ key: "B" }));
        });

        it("spells a German accidental as a word", () => {
            expect(named({ key: "eflat" }, "de")).toContain("Es");
            expect(named({ key: "fsharp" }, "de")).toContain("Fis");
        });

        it("writes a German minor key's tonic in lower case, and a major one's not", () => {
            expect(named({ key: "a", type: "natural-minor-scale" }, "de")).toBe(
                m.exercise_title_natural_minor_scale({ key: "a" }),
            );
            expect(named({ key: "fsharp", type: "minor-arpeggio" }, "de")).toContain("fis-Moll");
            expect(named({ key: "a", type: "major-scale" }, "de")).toContain("A-Dur");
        });

        it("names a French key in do re mi, the flat as a word", () => {
            expect(named({ key: "bflat" }, "fr")).toBe("Gamme de si bémol majeur");
            expect(named({ key: "d" }, "fr")).toBe("Gamme de ré majeur");
        });

        it("capitalises a syllable that opens the title, as any first word is", () => {
            expect(named({ key: "d" }, "tr", "solfege")).toBe(
                m.exercise_title_major_scale({ key: "Re" }, { locale: "tr" }),
            );
        });

        it("follows the player's letters over the language's syllables", () => {
            // A French player who chose letters on the keys reads letters in every title.
            expect(named({ key: "bflat" }, "fr", "all")).toBe("Gamme de B♭ majeur");
        });

        it("follows the player's H over the language's B", () => {
            expect(named({ key: "b" }, "en", "all", "h")).toBe(
                m.exercise_title_major_scale({ key: "H" }),
            );
        });

        it("leaves English on letters, minor keys in capitals", () => {
            expect(named({ key: "b" }, "en")).toContain("B");
            expect(named({ key: "a", type: "natural-minor-scale" }, "en")).toBe(
                m.exercise_title_natural_minor_scale({ key: "A" }),
            );
        });
    });
});
