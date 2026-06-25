// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { LocalizedLink as Link } from "../components/localizedLink";
import { ScoreViewer } from "../components/scoreViewer";
import { resolveScore, type Score } from "../lib/catalog";
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
        return routeMeta("Play", "Practice a piece with your MIDI piano or computer keyboard");
    }
    const by = score.composer ? ` by ${score.composer}` : "";
    return [
        ...routeMeta(
            score.title,
            `Practice "${score.title}"${by} in your browser — sight-read and play it with your MIDI or computer keyboard.`,
        ),
        { "script:ld+json": musicCompositionData(score.title, score.composer, getLocale()) },
    ];
}

export default function PlayRoute({ params }: Route.ComponentProps) {
    // The catalogue is read from local storage and bundled MusicXML on the client,
    // so the piece resolves a tick after paint: undefined while loading, null when
    // there is no such score.
    const [score, setScore] = useState<Score | null | undefined>(undefined);
    useEffect(() => {
        setScore(resolveScore(params.scoreId) ?? null);
    }, [params.scoreId]);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            {score && (
                <>
                    <header className="space-y-1">
                        <h1 className="text-2xl font-semibold">{score.title}</h1>
                        {score.composer && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {score.composer}
                            </p>
                        )}
                    </header>
                    <ScoreViewer
                        key={score.id}
                        id={score.id}
                        xml={score.xml}
                        title={score.title}
                        initialTempo={score.tempo}
                        beatsPerBar={score.beatsPerBar}
                    />
                </>
            )}
            {score === null && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.play_not_found()}</p>
            )}
            <Link to="/scores" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.scores_heading()}
            </Link>
        </main>
    );
}
