// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSearchParams } from "react-router";
import { useSeededState } from "../hooks/useSeededState";
import type { EarExerciseId } from "../../core/earExercise";
import { routeMeta, webPageData } from "../../core/site";
import { EarSession } from "../components/features/earSession";
import { EXERCISE_LABELS, LEVEL_LABELS } from "../lib/earLabels";
import { ChoiceField } from "../components/ui/fields";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/ear";
import { PageHeader } from "../components/ui/pageHeader";

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
    const exerciseParam = params.get("exercise");
    const [exercise, setExercise] = useSeededState<EarExerciseId>(exerciseParam, (param) =>
        isExercise(param) ? param : "intervals",
    );
    // The level is seeded by both parameters: which level is in range depends on which
    // exercise the address named.
    const [level, setLevel] = useSeededState(
        `${exerciseParam ?? ""}|${params.get("level") ?? ""}`,
        () => {
            const named: EarExerciseId = isExercise(exerciseParam) ? exerciseParam : "intervals";
            const paramLevel = Number(params.get("level"));
            return Number.isInteger(paramLevel) &&
                paramLevel >= 0 &&
                paramLevel < LEVEL_LABELS[named].length
                ? String(paramLevel)
                : "0";
        },
    );

    const levels = LEVEL_LABELS[exercise];

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.ear_title()} hint={m.ear_intro()} />

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
