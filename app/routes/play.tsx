// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { Show } from "../components/conditional";
import { EarPiece } from "../components/earPiece";
import { ExerciseForms } from "../components/exerciseForms";
import { LocalizedLink as Link } from "../components/localizedLink";
import { PieceFingering } from "../components/pieceFingering";
import { type PlayMode, PlayModeBar } from "../components/playModeBar";
import { ScoreGrade } from "../components/scoreGrade";
import { ScoreViewer } from "../components/scoreViewer";
import { useScore } from "../hooks/useScore";
import { resolveScore } from "../lib/catalog";
import { parseExerciseId } from "../lib/exerciseGen";
import { musicCompositionData, routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/play";

export function meta({ params }: Route.MetaArgs) {
    // Bundled scores resolve at prerender (no localStorage), so each one gets its
    // own title, description, and structured data — making the catalogue's pieces
    // indexable instead of every play page sharing a generic shell.
    const score = resolveScore(params.scoreId);
    if (!score) {
        return routeMeta(m.meta_play_title(), m.meta_play_description_fallback());
    }
    const description = score.composer
        ? m.meta_play_description_by({ title: score.title, composer: score.composer })
        : m.meta_play_description({ title: score.title });
    return [
        ...routeMeta(score.title, description),
        { "script:ld+json": musicCompositionData(score.title, score.composer, getLocale()) },
    ];
}

export default function PlayRoute({ params }: Route.ComponentProps) {
    // Resolves a tick after paint: undefined while loading, null when there is no
    // such score.
    const score = useScore(params.scoreId);
    const [mode, setMode] = useState<PlayMode>("play");

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            {score && (
                <>
                    <header className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-semibold">{score.title}</h1>
                            <ScoreGrade id={score.id} xml={score.xml} />
                        </div>
                        {score.composer && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {score.composer}
                            </p>
                        )}
                    </header>

                    <PlayModeBar mode={mode} onChange={setMode} />

                    <Show when={mode === "play"}>
                        {parseExerciseId(score.id) && (
                            <ExerciseForms config={parseExerciseId(score.id)!} />
                        )}
                        <ScoreViewer
                            key={score.id}
                            id={score.id}
                            xml={score.xml}
                            title={score.title}
                            initialTempo={score.tempo}
                            beatsPerBar={score.beatsPerBar}
                            canShareGhost
                        />
                    </Show>
                    {mode === "ear" && <EarPiece xml={score.xml} />}
                    {mode === "fingering" && <PieceFingering id={score.id} xml={score.xml} />}
                </>
            )}
            <Show when={score === null}>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.play_not_found()}</p>
            </Show>
            <Link to="/library" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.library_heading()}
            </Link>
        </main>
    );
}
