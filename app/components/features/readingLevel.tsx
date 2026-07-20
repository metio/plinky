// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {
    READING_LEVELS,
    type ReadingLevel as Level,
    levelAids,
    levelOf,
} from "../../../core/readingLevel";
import { usePrefs } from "../../hooks/usePrefs";
import { m } from "../../paraglide/messages.js";
import { SegmentedControl } from "../ui/segmentedControl";

const NAME: Record<Level, () => string> = {
    starter: m.reading_level_starter,
    learning: m.reading_level_learning,
    confident: m.reading_level_confident,
    sightReader: m.reading_level_sight_reader,
};

// The skill-level preset: one control that sets the reading aids together — note
// names, the next-key glow, colour, keep-going, and the notes highway — from a new
// starter's full help down to a sight-reader's bare staff. Fingering numbers are
// left out on purpose: they confuse a beginner who hasn't been taught them, so the
// level never touches them.
// Personal and physical prefs (hand span, key map, sound, metronome, the grade
// policy) are never touched. The level is derived from the aids themselves
// (core/readingLevel), so it reads "Custom" the instant you hand-tune one and
// there is no separate stored level that could drift. Shown in both the Settings
// Reading section and the run-setup panel — the same prefs, two doors.
export function ReadingLevel() {
    const { prefs, update } = usePrefs();
    const level = levelOf(prefs);
    const options = READING_LEVELS.map((id) => ({ id, label: NAME[id]() }));
    return (
        <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {m.reading_level_label()}
            </span>
            <SegmentedControl<Level | "custom">
                label={m.reading_level_label()}
                options={options}
                // "custom" is not among the options, so no segment reads as selected —
                // exactly right for a hand-tuned mix that matches no level.
                value={level}
                onChange={(id) => {
                    if (id !== "custom") {
                        update(levelAids(id));
                    }
                }}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {level === "custom" ? m.reading_level_custom_help() : m.reading_level_help()}
            </p>
        </div>
    );
}
