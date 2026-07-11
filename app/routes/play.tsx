// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Attribution } from "../components/ui/attribution";
import { Button } from "../components/ui/button";
import { attributionFor } from "../../core/attribution";
import { personSlug } from "../../core/person";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { creditLine } from "../../core/videoScene";
import { Show } from "../components/features/conditional";
import { EarPiece } from "../components/features/earPiece";
import { ExerciseForms } from "../components/features/exerciseForms";
import { ExportButton } from "../components/features/exportButton";
import { BacklogButton } from "../components/features/backlogButton";
import { MarkLearnedButton } from "../components/features/markLearnedButton";
import { PieceFingering } from "../components/features/pieceFingering";
import { type PlayMode, PlayModeBar } from "../components/features/playModeBar";
import { PrintButton } from "../components/features/printButton";
import { ScoreGrade } from "../components/features/scoreGrade";
import { ScoreViewer } from "../components/features/scoreViewer";
import { TransposeProvider } from "../components/features/transposeContext";
import { useOnboardingStore } from "../contexts/services";
import { useScore } from "../hooks/useScore";
// meta() runs outside the React tree (the router calls it statically), so it
// cannot receive injected services — the real adapter is wired here directly,
// the same way the composition root wires its defaults.
import { browserStore } from "../adapters/browserStore";
import { resolveScore } from "../lib/catalog";
import { parseExerciseId } from "../../core/exerciseGen";

import { musicCompositionData, routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/play";

export function meta({ params }: Route.MetaArgs) {
    // Bundled scores resolve at prerender (no localStorage), so each one gets its
    // own title, description, and structured data — making the catalogue's pieces
    // indexable instead of every play page sharing a generic shell.
    const score = resolveScore(browserStore, params.scoreId);
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
    const onboarding = useOnboardingStore();
    // Resolves a tick after paint: undefined while loading, null when there is no
    // such score, "unavailable" when a fetch failed — a retry bumps `attempt`
    // to ask again (a failed fetch is never cached).
    const [attempt, setAttempt] = useState(0);
    const resolved = useScore(params.scoreId, attempt);
    const score = resolved === "unavailable" ? undefined : resolved;
    const [mode, setMode] = useState<PlayMode>("play");
    // Transposition is a page option shared by the score and the title-line Print /
    // Export buttons, so all three render in the same key.
    const [transpose, setTranspose] = useState(0);

    // A ?mode=ear|fingering link (from the discovery checklist) opens straight into
    // that drill. Applied after mount rather than as the initial state so it doesn't
    // diverge from the prerendered "play" markup, and it marks the matching discovery
    // step the same way switching with the mode bar does.
    const [searchParams] = useSearchParams();
    useEffect(() => {
        const requested = searchParams.get("mode");
        if (requested === "ear" || requested === "fingering") {
            setMode(requested);
            onboarding.markDiscovered(requested === "ear" ? "earTried" : "fingeringTried");
        }
    }, [searchParams, onboarding]);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            {score && (
                <TransposeProvider value={{ transpose, setTranspose }}>
                    <header className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-semibold">{score.title}</h1>
                                <ScoreGrade id={score.id} xml={score.xml} />
                            </div>
                            {/* The piece's secondary actions, on the title line so a
                            short title's empty space is used rather than taking a row
                            of their own; a long title wraps in the left column while
                            these stay pinned top-right. */}
                            <div className="flex shrink-0 items-center gap-1">
                                <PrintButton xml={score.xml} title={score.title} />
                                <ExportButton xml={score.xml} title={score.title} />
                                <MarkLearnedButton id={score.id} />
                                <BacklogButton id={score.id} />
                            </div>
                        </div>
                        {score.composer && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {/* The composer's name opens their page — everything of
                                    theirs in the catalogue, one tap away. */}
                                {personSlug(score.composer) ? (
                                    <Link
                                        to={`/person/${personSlug(score.composer)}`}
                                        className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                                    >
                                        {score.composer}
                                    </Link>
                                ) : (
                                    score.composer
                                )}
                            </p>
                        )}
                        <Attribution
                            composer={score.composer}
                            license={score.license}
                            source={score.source}
                        />
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
                            credit={creditLine(
                                score.title,
                                attributionFor({
                                    composer: score.composer,
                                    license: score.license,
                                    source: score.source,
                                }),
                            )}
                            initialTempo={score.tempo}
                            beatsPerBar={score.beatsPerBar}
                            canShareGhost
                        />
                    </Show>
                    {mode === "ear" && <EarPiece xml={score.xml} />}
                    {mode === "fingering" && <PieceFingering id={score.id} xml={score.xml} />}
                </TransposeProvider>
            )}
            <Show when={score === null}>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.play_not_found()}</p>
            </Show>
            <Show when={resolved === "unavailable"}>
                <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {m.play_unavailable()}
                    </p>
                    <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                        {m.play_retry()}
                    </Button>
                </div>
            </Show>
        </main>
    );
}
