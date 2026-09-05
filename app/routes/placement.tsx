// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { generateDrill } from "../../core/drill";
import type { Grade } from "../../core/grade";
import {
    advancePlacement,
    levelDrill,
    MAX_STRIKES,
    type Placement,
    placementGrade,
    placementProgress,
    placementRating,
    startPlacement,
} from "../../core/placement";
import { noindexMeta, routeMeta } from "../../core/site";
import { ScoreViewer } from "../components/features/scoreViewer";
import { Button } from "../components/ui/button";
import { ServicesProvider, usePlacementStore } from "../contexts/services";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/placement";
import { PageHeader } from "../components/ui/pageHeader";
import { useUnaidedServices } from "../hooks/useUnaidedServices";

export function meta(_args: Route.MetaArgs) {
    // A personal, data-driven page like the review session: it needs a title (a document
    // without one is a bare URL in the reader's tabs and history, and axe flags it), but
    // it has no place in the index.
    return [...routeMeta(m.placement_title(), m.meta_placement_description()), noindexMeta()];
}

// The placement test: read a drill, and the next one is harder or the run takes a
// strike. Nothing here is repertoire — every drill is generated on the spot, so
// what it measures is reading rather than whether this piece happens to be
// familiar.

type Live = { state: Placement; xml: string; run: number };

function drillFor(state: Placement): string {
    return generateDrill(
        levelDrill(state.level, m.placement_drill({ level: state.level })),
        Math.random,
    );
}

export default function PlacementRoute() {
    const placement = usePlacementStore();
    // The drill runs on its own preferences, not the player's. A test that can be taken
    // with the notes falling down a highway, the noteheads coloured and the cursor waiting
    // is not measuring reading — so the aids are fixed off for the subtree, and the set-up
    // panel is not rendered at all rather than rendered inert.
    const assessed = useUnaidedServices();
    const [live, setLive] = useState<Live | null>(null);
    const saved = placement.load();

    const begin = () => {
        const state = startPlacement();
        setLive({ state, xml: drillFor(state), run: 0 });
    };

    // A finished drill moves the ladder. The test keeps its own score rather than
    // the practice grade's letter: it is asking one question, and a number is the
    // answer to it.
    const graded = (grade: Grade) => {
        setLive((current) => {
            if (!current || current.state.done) {
                return current;
            }
            const next = advancePlacement(current.state, grade.score);
            if (next.done) {
                placement.save({
                    rating: placementRating(next),
                    grade: placementGrade(next),
                    takenAt: Date.now(),
                });
            }
            return { state: next, xml: drillFor(next), run: current.run + 1 };
        });
    };

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.placement_title()} hint={m.placement_intro()} />

            {!live && (
                <div className="space-y-3">
                    {saved && (
                        <p className="text-sm text-body">
                            {m.placement_last({ rating: saved.rating, grade: saved.grade })}
                        </p>
                    )}
                    <Button variant="primary" onClick={begin}>
                        {saved ? m.placement_again() : m.placement_start()}
                    </Button>
                </div>
            )}

            {live && !live.state.done && (
                <>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-body">
                            {m.placement_level({ level: live.state.level })}
                        </p>
                        <p className="text-sm text-muted">
                            {m.placement_strikes({
                                used: live.state.strikes,
                                total: MAX_STRIKES,
                            })}
                        </p>
                        <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-strong"
                            role="progressbar"
                            aria-valuenow={Math.round(placementProgress(live.state) * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={m.placement_progress()}
                        >
                            <div
                                className="h-full bg-chart-peak"
                                style={{ width: `${placementProgress(live.state) * 100}%` }}
                            />
                        </div>
                    </div>
                    <ServicesProvider services={assessed}>
                        <ScoreViewer
                            key={live.run}
                            id={`placement-${live.state.level}`}
                            xml={live.xml}
                            title={m.placement_drill({ level: live.state.level })}
                            beatsPerBar={4}
                            onGraded={graded}
                            ephemeral
                            assessment
                        />
                    </ServicesProvider>
                </>
            )}

            {live?.state.done && (
                <div className="space-y-3">
                    <p className="text-lg font-semibold">
                        {m.placement_result({
                            rating: placementRating(live.state),
                            grade: placementGrade(live.state),
                        })}
                    </p>
                    <p className="text-sm text-muted">{m.placement_result_hint()}</p>
                    <Button variant="secondary" onClick={() => setLive(null)}>
                        {m.placement_done()}
                    </Button>
                </div>
            )}
        </main>
    );
}
