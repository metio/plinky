// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ExerciseConfig, ExerciseForm, ExerciseType } from "../../core/exerciseGen";
import { exerciseTitleParts } from "../../core/exerciseGen";
import { m } from "../paraglide/messages.js";
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
};

export function exerciseName(config: ExerciseConfig): string {
    const { key, type, forms } = exerciseTitleParts(config);
    const title = TITLES[type]({ key });
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
