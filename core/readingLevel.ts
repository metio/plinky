// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Prefs } from "./prefs";

// The reading aids a skill level sets together — the help that scales from a true
// beginner to a sight-reader. ONLY these fields are swept by a level; personal and
// physical prefs (hand span, key map, mic, sound, metronome, the grade/review
// policy, layout preferences) are never touched by picking a level.
export type AidPrefs = Pick<
    Prefs,
    "noteLabels" | "noteHints" | "colorNotes" | "showFingerings" | "forgiving" | "highway"
>;

// The skill ladder, most help first. No separate "level" is stored: the current
// level is derived by comparing the aid fields against these tables, so the aids
// stay the single source of truth and can never drift from a stored level.
export type ReadingLevel = "starter" | "learning" | "confident" | "sightReader";
export const READING_LEVELS: ReadingLevel[] = ["starter", "learning", "confident", "sightReader"];

// Each level's aid values, monotonically shedding help down the ladder: names,
// next-key glow, colour, fingering numbers, keep-going, and the notes highway all
// on for a new starter; nothing on for a sight-reader reading the staff cold.
const AIDS: Record<ReadingLevel, AidPrefs> = {
    starter: {
        noteLabels: "all",
        noteHints: "always",
        colorNotes: true,
        showFingerings: true,
        forgiving: true,
        highway: true,
    },
    learning: {
        noteLabels: "all",
        noteHints: "always",
        colorNotes: false,
        showFingerings: false,
        forgiving: true,
        highway: false,
    },
    confident: {
        noteLabels: "c",
        noteHints: "miss",
        colorNotes: false,
        showFingerings: false,
        forgiving: false,
        highway: false,
    },
    sightReader: {
        noteLabels: "off",
        noteHints: "never",
        colorNotes: false,
        showFingerings: false,
        forgiving: false,
        highway: false,
    },
};

// The aid settings a level applies — merge into the prefs store so only the aid
// fields change and every personal/physical pref is left as it was.
export function levelAids(level: ReadingLevel): AidPrefs {
    return AIDS[level];
}

// The level whose aids exactly match the current prefs, or "custom" when the mix
// matches none — what the level control highlights, and the marker of a hand-tuned
// setup. Compares only the aid fields, so unrelated prefs never affect the result.
export function levelOf(prefs: AidPrefs): ReadingLevel | "custom" {
    return (
        READING_LEVELS.find((level) => {
            const aids = AIDS[level];
            return (Object.keys(aids) as (keyof AidPrefs)[]).every((key) => aids[key] === prefs[key]);
        }) ?? "custom"
    );
}
