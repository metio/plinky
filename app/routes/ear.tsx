// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { useSearchParams } from "react-router";
import type { EarExerciseId } from "../../core/earExercise";
import { routeMeta } from "../../core/site";
import { EarSession } from "../components/features/earSession";
import { ChoiceField } from "../components/ui/fields";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/ear";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.meta_ear_title(), m.meta_ear_description());
}

const EXERCISES: { id: EarExerciseId; label: () => string }[] = [
    { id: "intervals", label: m.ear_exercise_intervals },
    { id: "chords", label: m.ear_exercise_chords },
    { id: "scales", label: m.ear_exercise_scales },
    { id: "progressions", label: m.ear_exercise_progressions },
    { id: "perfect-pitch", label: m.ear_exercise_perfect_pitch },
];

// Each level is named by what it adds rather than numbered: "Thirds & fourths" says what
// the round holds, where "Level 2" only says it comes after level 1. Perfect pitch has no
// levels. Chords and scales share the "Major & minor" and "Everything" ends.
const LEVELS: Record<EarExerciseId, (() => string)[]> = {
    intervals: [m.ear_level_fifths, m.ear_level_thirds, m.ear_level_seconds, m.ear_level_all],
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
    "perfect-pitch": [],
};

function isExercise(value: string | null): value is EarExerciseId {
    return value !== null && value in LEVELS;
}

export default function Ear() {
    // A suggestion or a review link can open straight on a chosen drill (?exercise=&level=);
    // otherwise the page rests on the first interval level.
    const [params] = useSearchParams();
    const param = params.get("exercise");
    const initial: EarExerciseId = isExercise(param) ? param : "intervals";
    const paramLevel = Number(params.get("level"));
    const [exercise, setExercise] = useState<EarExerciseId>(initial);
    const [level, setLevel] = useState(
        Number.isInteger(paramLevel) && paramLevel >= 0 && paramLevel < LEVELS[initial].length
            ? String(paramLevel)
            : "0",
    );

    const levels = LEVELS[exercise];

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.ear_title()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.ear_intro()}</p>
            </header>

            <ChoiceField
                label={m.ear_exercise_label()}
                value={exercise}
                onChange={(next) => setExercise(next as EarExerciseId)}
                options={EXERCISES.map((item) => ({ id: item.id, label: item.label() }))}
            />

            {levels.length > 0 ? (
                <ChoiceField
                    label={m.ear_level_label()}
                    value={level}
                    onChange={setLevel}
                    options={levels.map((label, index) => ({ id: String(index), label: label() }))}
                    help={m.ear_level_help()}
                />
            ) : null}

            {/* Keyed on the pair, so choosing a different exercise or level starts a fresh
                session — the reset falls out of the remount rather than a handler. */}
            <EarSession key={`${exercise}-${level}`} exercise={exercise} level={Number(level)} />
        </main>
    );
}
