// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { EarItem } from "../../core/earCatalog";
import type { EarExerciseId } from "../../core/earExercise";
import { m } from "../paraglide/messages.js";

// The names the /ear page and the grade ladder both show for an exercise and its levels.
// core owns the language-neutral difficulty (the level sets, the grades); this is where
// each gains its translated name, kept in one place so the exercise picker, the level
// picker and a grade-ladder entry always read the same.

export const EXERCISE_LABELS: Record<EarExerciseId, () => string> = {
    intervals: m.ear_exercise_intervals,
    chords: m.ear_exercise_chords,
    scales: m.ear_exercise_scales,
    progressions: m.ear_exercise_progressions,
    "scale-degrees": m.ear_exercise_scale_degrees,
    "intervals-context": m.ear_exercise_intervals_context,
    "melodic-dictation": m.ear_exercise_melodic,
    "perfect-pitch": m.ear_exercise_perfect_pitch,
};

// Each exercise's levels, named by what they add. Perfect pitch has none. Intervals in
// context reuses the interval level names — the sets are the same, only the framing (a
// cadence first) differs.
const INTERVAL_LEVEL_NAMES = [
    m.ear_level_fifths,
    m.ear_level_thirds,
    m.ear_level_seconds,
    m.ear_level_all,
];

export const LEVEL_LABELS: Record<EarExerciseId, (() => string)[]> = {
    intervals: INTERVAL_LEVEL_NAMES,
    chords: [
        m.ear_level_major_minor,
        m.ear_chord_level_triads,
        m.ear_chord_level_sevenths,
        m.ear_level_all,
    ],
    scales: [
        m.ear_level_major_minor,
        m.ear_scale_level_minors,
        m.ear_scale_level_modes,
        m.ear_level_all,
    ],
    progressions: [
        m.ear_prog_level_primary,
        m.ear_prog_level_pop,
        m.ear_prog_level_triads,
        m.ear_level_all,
    ],
    "scale-degrees": [m.ear_sd_level_triad, m.ear_sd_level_diatonic, m.ear_sd_level_chromatic],
    "intervals-context": INTERVAL_LEVEL_NAMES,
    "melodic-dictation": [m.ear_md_level_short, m.ear_md_level_medium, m.ear_md_level_long],
    "perfect-pitch": [],
};

// A grade-ladder entry's title: the exercise name, and — for a laddered exercise — the
// level it trains, so a mastered ear item reads exactly like the round that earned it.
export function earItemTitle(item: EarItem): string {
    const name = EXERCISE_LABELS[item.exercise]();
    if (item.level === null) {
        return name;
    }
    const level = LEVEL_LABELS[item.exercise][item.level];
    return level ? `${name} · ${level()}` : name;
}
