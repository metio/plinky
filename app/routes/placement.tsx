// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
import { ScoreViewer } from "../components/features/scoreViewer";
import { Button } from "../components/ui/button";
import { usePlacementStore } from "../contexts/services";
import { m } from "../paraglide/messages.js";

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
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.placement_title()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.placement_intro()}</p>
            </header>

            {!live && (
                <div className="space-y-3">
                    {saved && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
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
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {m.placement_level({ level: live.state.level })}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {m.placement_strikes({
                                used: live.state.strikes,
                                total: MAX_STRIKES,
                            })}
                        </p>
                        <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
                            role="progressbar"
                            aria-valuenow={Math.round(placementProgress(live.state) * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={m.placement_progress()}
                        >
                            <div
                                className="h-full bg-indigo-500"
                                style={{ width: `${placementProgress(live.state) * 100}%` }}
                            />
                        </div>
                    </div>
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {m.placement_result_hint()}
                    </p>
                    <Button variant="secondary" onClick={() => setLive(null)}>
                        {m.placement_done()}
                    </Button>
                </div>
            )}
        </main>
    );
}
