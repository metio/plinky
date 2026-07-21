// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { useSearchParams } from "react-router";
import type { EarExerciseId } from "../../core/earExercise";
import { routeMeta, webPageData } from "../../core/site";
import { EarSession } from "../components/features/earSession";
import { EXERCISE_LABELS, LEVEL_LABELS } from "../lib/earLabels";
import { ChoiceField } from "../components/ui/fields";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/ear";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.meta_ear_title(), m.meta_ear_description()),
        {
            "script:ld+json": webPageData(
                m.meta_ear_title(),
                m.meta_ear_description(),
                getLocale(),
                "/ear/",
            ),
        },
    ];
}

// The order the picker lists them: the "identify what you hear" run, then the functional
// exercises that hear notes against a key, then perfect pitch.
const ORDER: EarExerciseId[] = [
    "intervals",
    "chords",
    "scales",
    "progressions",
    "scale-degrees",
    "intervals-context",
    "melodic-dictation",
    "perfect-pitch",
];

function isExercise(value: string | null): value is EarExerciseId {
    return value !== null && value in LEVEL_LABELS;
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
        Number.isInteger(paramLevel) && paramLevel >= 0 && paramLevel < LEVEL_LABELS[initial].length
            ? String(paramLevel)
            : "0",
    );

    const levels = LEVEL_LABELS[exercise];

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.ear_title()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.ear_intro()}</p>
            </header>

            <ChoiceField
                label={m.ear_exercise_label()}
                value={exercise}
                onChange={(next) => {
                    const id = next as EarExerciseId;
                    setExercise(id);
                    // Exercises differ in how many levels they offer; a level index valid for the
                    // old drill can be out of range for the new one, which would leave the picker
                    // with no active segment while the session silently ran the easiest level.
                    if (Number(level) >= LEVEL_LABELS[id].length) {
                        setLevel("0");
                    }
                }}
                options={ORDER.map((id) => ({ id, label: EXERCISE_LABELS[id]() }))}
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
