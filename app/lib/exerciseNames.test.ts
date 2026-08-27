// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { EXERCISE_TILES, type ExerciseConfig, exerciseTitle } from "../../core/exerciseGen";
import { m } from "../paraglide/messages.js";
import { baseLocale, overwriteGetLocale } from "../paraglide/runtime.js";
import { exerciseName } from "./exerciseNames";

const base: ExerciseConfig = {
    type: "major-scale",
    key: "c",
    octaves: 1,
    hands: "right",
    inversion: 0,
    interval: "single",
};

describe("exerciseName", () => {
    it("names a scale with the key inside the phrase, not bolted onto it", () => {
        expect(exerciseName(base)).toBe(m.exercise_title_major_scale({ key: "C" }));
    });

    it("adds the forms that make this one different", () => {
        expect(exerciseName({ ...base, octaves: 2, hands: "both" })).toBe(
            `${m.exercise_title_major_scale({ key: "C" })} · ${m.exercise_form_two_octaves()}, ${m.exercise_form_both_hands()}`,
        );
    });

    it("says nothing about the plain form", () => {
        expect(exerciseName(base)).not.toContain("·");
    });

    it("has a translated name for every exercise the app can generate", () => {
        // A missing entry would fall through to undefined and title a piece "undefined";
        // the tiles are the full set of kinds the library and the arcade can produce.
        for (const tile of EXERCISE_TILES) {
            const name = exerciseName(tile);
            expect(name.length).toBeGreaterThan(0);
            expect(name).not.toContain("undefined");
        }
    });

    it("carries the key spelling core works out, sharps and flats included", () => {
        expect(exerciseName({ ...base, key: "eflat" })).toContain("E♭");
        expect(exerciseName({ ...base, key: "fsharp" })).toContain("F♯");
    });

    it("is not the English the manifest was built with", () => {
        // en is the test locale, so the two agree here — what this pins is that the app
        // asks the message catalogue rather than reusing the score's baked-in title.
        // Every other locale gets its own wording from the same call.
        const config: ExerciseConfig = { ...base, type: "dom7-arpeggio", octaves: 2 };
        expect(exerciseName(config)).toBe(
            `${m.exercise_title_dom7_arpeggio({ key: "C" })} · ${m.exercise_form_two_octaves()}`,
        );
        expect(exerciseTitle(config)).toBe("C dominant 7th arpeggio · 2 octaves");
    });

    describe("naming the key the way the language does", () => {
        // German notation calls B natural H and reserves B for B flat, so naming keys with
        // English letters did not read oddly to a German student — it told them to play a
        // different scale, in the one place a beginner has no way to check it.
        const named = (key: string, locale: "de" | "en" | "fr") => {
            overwriteGetLocale(() => locale);
            try {
                return exerciseName({ ...base, key });
            } finally {
                overwriteGetLocale(() => baseLocale);
            }
        };

        it("calls B natural H in German", () => {
            expect(named("b", "de")).toContain("H");
            expect(named("b", "de")).not.toContain("B-");
        });

        it("calls B flat B in German, which is what B means there", () => {
            expect(named("bflat", "de")).toContain("B");
            expect(named("bflat", "de")).not.toContain("♭");
        });

        it("spells a German accidental as a word", () => {
            expect(named("eflat", "de")).toContain("Es");
            expect(named("fsharp", "de")).toContain("Fis");
        });

        it("leaves every other language on letters", () => {
            expect(named("b", "en")).toContain("B");
            expect(named("eflat", "fr")).toContain("E♭");
        });
    });
});
