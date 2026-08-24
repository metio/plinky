// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Attribution } from "../components/ui/attribution";
import { ScoreIncipit } from "../components/features/scoreIncipit";
import { Button } from "../components/ui/button";
import { attributionFor } from "../../core/attribution";
import { canonicalComposer, personSlug } from "../../core/person";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { creditLine } from "../../core/videoScene";
import { Show } from "../components/features/conditional";
import { ExerciseForms } from "../components/features/exerciseForms";
import { BacklogButton } from "../components/features/backlogButton";
import { MarkLearnedButton } from "../components/features/markLearnedButton";
import { type PlayMode, PlayModeBar } from "../components/features/playModeBar";
import { FavoriteButton } from "../components/features/favoriteButton";
import { ExportMenu } from "../components/features/exportMenu";
import { ScoreGrade } from "../components/features/scoreGrade";
import { ScoreViewer } from "../components/features/scoreViewer";
import { ScoreSkeleton } from "../components/ui/scoreSkeleton";
import { TransposeProvider } from "../components/features/transposeContext";
import { useScore } from "../hooks/useScore";
// meta() runs outside the React tree (the router calls it statically), so it
// cannot receive injected services — the real adapter is wired here directly,
// the same way the composition root wires its defaults.
import { browserStore } from "../adapters/browserStore";
import { resolveScore } from "../lib/catalog";
import { warmEngraver } from "../lib/warmEngraver";
import { parseExerciseId } from "../../core/exerciseGen";

import { breadcrumbData, musicCompositionData, routeMeta } from "../../core/site";

// Reaching this module means a piece is being opened, and a piece always needs engraving.
// Starting the fetch here overlaps it with the rest of the page's startup instead of
// queueing it behind the whole tree rendering first.
warmEngraver();
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/play";
import { useSearchParams } from "react-router";
import { readPlayOptions } from "../../core/playOptions";

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
    const locale = getLocale();
    // The piece's place in the catalogue: Home › Library › [Composer] › Piece. The
    // composer crumb links to their page when the credit resolves to a real person,
    // matching the prerendered /person/:slug and the on-page composer link.
    const slug = score.composer ? personSlug(score.composer) : "";
    const trail = [
        { name: m.nav_today(), path: "/" },
        { name: m.music_title(), path: "/music/" },
        ...(slug ? [{ name: canonicalComposer(score.composer), path: `/person/${slug}/` }] : []),
        { name: score.title, path: `/play/${score.id}/` },
    ];
    return [
        ...routeMeta(score.title, description),
        { "script:ld+json": musicCompositionData(score.title, score.composer, locale) },
        { "script:ld+json": breadcrumbData(locale, trail) },
    ];
}

export default function PlayRoute({ params }: Route.ComponentProps) {
    // Resolves a tick after paint: undefined while loading, null when there is no
    // such score, "unavailable" when a fetch failed — a retry bumps `attempt`
    // to ask again (a failed fetch is never cached).
    const [attempt, setAttempt] = useState(0);
    const resolved = useScore(params.scoreId, attempt);
    const score = resolved === "unavailable" ? undefined : resolved;
    // ?tab=runs opens straight onto your saved runs, so a recording can be linked to —
    // the shelf's list of takes points here.
    const [searchParams] = useSearchParams();
    const [mode, setMode] = useState<PlayMode>(
        searchParams.get("tab") === "runs" ? "runs" : "play",
    );
    // The rest of the address says how the piece should OPEN — slower, one hand, a loop
    // over a few bars, a friendlier key. That is what lets a practice suggestion hand over
    // the control that does it instead of pointing at the library and wishing you luck, and
    // what lets a teacher send "this piece, at sixty per cent, left hand". Read once: these
    // seed the controls, and the player owns them from the first frame onward, so a later
    // address change must not reach in and undo what they have since chosen.
    const [options] = useState(() => readPlayOptions((key) => searchParams.get(key)));
    // Transposition is a page option shared by the score and the title-line Print /
    // Export buttons, so all three render in the same key.
    const [transpose, setTranspose] = useState(options.transpose ?? 0);

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            {score && (
                <TransposeProvider value={{ transpose, setTranspose }}>
                    <header className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="font-display text-3xl font-semibold tracking-tight">
                                    {score.title}
                                </h1>
                                {/* Right beside the name, so keeping a piece is a thought
                                you can act on while playing it rather than an errand in
                                the library. */}
                                <FavoriteButton id={score.id} />
                                <ScoreGrade id={score.id} xml={score.xml} />
                            </div>
                            {/* The piece's secondary actions, on the title line so a
                            short title's empty space is used rather than taking a row
                            of their own; a long title wraps in the left column while
                            these stay pinned top-right. */}
                            <div className="flex shrink-0 items-center gap-1">
                                <ExportMenu xml={score.xml} title={score.title} />
                                <MarkLearnedButton id={score.id} />
                                <BacklogButton id={score.id} />
                            </div>
                        </div>
                        {score.composer && (
                            <p className="text-sm text-muted">
                                {/* The composer's name opens their page — everything of
                                    theirs in the catalogue, one tap away. */}
                                {personSlug(score.composer) ? (
                                    <Link
                                        to={`/person/${personSlug(score.composer)}`}
                                        className="hover:text-accent-strong hover:underline"
                                    >
                                        {canonicalComposer(score.composer)}
                                    </Link>
                                ) : (
                                    // Cleaned on this branch too: a credit naming a
                                    // tradition rather than a person is still a credit.
                                    canonicalComposer(score.composer)
                                )}
                            </p>
                        )}
                        {/* The piece's opening bar, under its name — the mark a
                            thematic catalogue would file it by. */}
                        <ScoreIncipit xml={score.xml} title={score.title} />
                        <Attribution
                            composer={score.composer}
                            license={score.license}
                            source={score.source}
                        />
                    </header>

                    <PlayModeBar mode={mode} onChange={setMode} />

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
                        options={options}
                        initialTempo={score.tempo}
                        beatsPerBar={score.beatsPerBar}
                        canShareGhost
                        runsView={mode === "runs"}
                        onShowScore={() => setMode("play")}
                    />
                </TransposeProvider>
            )}
            {/* Resolving a piece means the catalogue and then the piece itself, which on a
            slow connection is seconds of a page with nothing on it at all. The staff it is
            about to appear on stands in the meantime, in the slot it will occupy. */}
            <Show when={resolved === undefined}>
                <div className="h-64">
                    <ScoreSkeleton />
                </div>
            </Show>
            <Show when={score === null}>
                <p className="text-sm text-muted">{m.play_not_found()}</p>
            </Show>
            <Show when={resolved === "unavailable"}>
                <div className="space-y-3">
                    <p className="text-sm text-muted">{m.play_unavailable()}</p>
                    <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                        {m.play_retry()}
                    </Button>
                </div>
            </Show>
        </main>
    );
}
