// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ExerciseConfig, ExerciseForm, ExerciseType } from "../../core/exerciseGen";
import { exerciseTitleParts } from "../../core/exerciseGen";
import type { Naming } from "../../core/noteNaming";
import { m } from "../paraglide/messages.js";
import { minorKeyText, noteText, opening } from "./noteNames";
import { getLocale } from "../paraglide/runtime.js";

// What a scale or arpeggio is called, in the reader's language. core works out which key
// it is in and what makes this one different; here it becomes words.
//
// Each kind carries the whole title with the key inside it, rather than a noun the app
// bolts a key onto: "C major scale" is "Do maggiore, scala" and "C-Dur-Tonleiter"
// elsewhere, and no amount of joining gets there from the parts.

const TITLES: Record<ExerciseType, (input: { key: string }) => string> = {
    "major-scale": m.exercise_title_major_scale,
    "natural-minor-scale": m.exercise_title_natural_minor_scale,
    "harmonic-minor-scale": m.exercise_title_harmonic_minor_scale,
    "melodic-minor-scale": m.exercise_title_melodic_minor_scale,
    "chromatic-scale": m.exercise_title_chromatic_scale,
    "major-arpeggio": m.exercise_title_major_arpeggio,
    "minor-arpeggio": m.exercise_title_minor_arpeggio,
    "dom7-arpeggio": m.exercise_title_dom7_arpeggio,
    "dim7-arpeggio": m.exercise_title_dim7_arpeggio,
    "major-chords": m.exercise_title_major_chords,
    "minor-chords": m.exercise_title_minor_chords,
};

const FORMS: Record<ExerciseForm, () => string> = {
    thirds: m.exercise_form_thirds,
    sixths: m.exercise_form_sixths,
    "two-octaves": m.exercise_form_two_octaves,
    "left-hand": m.exercise_form_left_hand,
    "both-hands": m.exercise_form_both_hands,
    contrary: m.exercise_form_contrary,
    "inversion-1": m.exercise_form_first_inversion,
    "inversion-2": m.exercise_form_second_inversion,
    sevenths: m.exercise_form_sevenths,
    open: m.exercise_form_open,
    alberti: m.exercise_form_alberti,
    broken: m.exercise_form_broken,
};

// The kinds whose key is a minor one, and so written in lower case where the language
// writes a minor tonic that way: a-Moll-Tonleiter, fiss-moll skala.
const MINOR: ReadonlySet<ExerciseType> = new Set([
    "natural-minor-scale",
    "harmonic-minor-scale",
    "melodic-minor-scale",
    "minor-arpeggio",
    "minor-chords",
]);

export function exerciseName(config: ExerciseConfig, naming: Naming): string {
    const { type, forms } = exerciseTitleParts(config);
    // The key named the way the player's keys name notes. German reads the letter B as B
    // flat and calls B natural H, so the scale of B natural is "H-Dur-Tonleiter"; French
    // names B flat "si bémol".
    const key = MINOR.has(type) ? minorKeyText(config.key, naming) : noteText(config.key, naming);
    const title = opening(TITLES[type]({ key }), naming);
    if (forms.length === 0) {
        return title;
    }
    // Intl joins the list the way the reader's own language does — commas here, "und"
    // before the last in German, no separator at all in Chinese — so no locale needs a
    // string for punctuation. The unit type is the one meant for a list of qualifiers.
    const listed = new Intl.ListFormat(getLocale(), { style: "short", type: "unit" }).format(
        forms.map((form) => FORMS[form]()),
    );
    return `${title} · ${listed}`;
}
