// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Prefs } from "./prefs";

// The reading aids a skill level sets together — the help that scales from a true
// beginner to a sight-reader. ONLY these fields are swept by a level; personal and
// physical prefs (hand span, key map, mic, sound, metronome, the grade/review
// policy, layout preferences) are never touched by picking a level.
// Note that fingering numbers are deliberately NOT here: they mean nothing to a
// beginner who hasn't been taught them, so they belong to no rung of the ladder —
// an independent, opt-in aid the level never touches.
export type AidPrefs = Pick<
    Prefs,
    "noteLabels" | "noteHints" | "colorNotes" | "forgiving" | "highway" | "showFingerings"
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
        forgiving: true,
        highway: true,
        showFingerings: true,
    },
    learning: {
        noteLabels: "all",
        noteHints: "always",
        colorNotes: false,
        forgiving: true,
        highway: false,
        // Printed fingering is a staff aid like the note names beside it, so it stays a
        // rung longer than the colour and the highway, which both go here.
        showFingerings: true,
    },
    confident: {
        noteLabels: "c",
        noteHints: "miss",
        colorNotes: false,
        forgiving: false,
        highway: false,
        showFingerings: false,
    },
    sightReader: {
        noteLabels: "off",
        noteHints: "never",
        colorNotes: false,
        forgiving: false,
        highway: false,
        showFingerings: false,
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
