// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Grade } from "../../../core/grade";
import type { TempoCurve } from "../../../core/runOutcome";
import { type Grid, handsPlayed, laggingHand, type RunNote } from "../../../core/shareCard";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { GradeLetter } from "../ui/gradeLetter";
import { PerformanceStrip } from "../ui/performanceStrip";
import { ShareCard } from "./shareCard";
import { TempoGraph } from "../ui/tempoGraph";

// The result a finished self-paced run drops into view: the grade with its
// accuracy/timing/flow breakdown, the per-note timing strip, the tempo curve, a
// lagging-hand verdict on a two-hand run, and the share card — led by the save-take
// prompt. Purely presentational: it derives its readouts from the run it is handed and
// reports a save request back through onSaveTake, so the same panel renders a fresh run or
// a seeded daily result identically.
export function RunResult({
    grade,
    notes,
    tolerance,
    grid,
    tempoCurve,
    tempoScale,
    daily,
    title,
    ephemeral,
    runSaved,
    onSaveTake,
}: {
    grade: Grade;
    notes: RunNote[];
    tolerance: number;
    grid: Grid | null;
    tempoCurve: TempoCurve | null;
    // Re-references the run to the piece's tempo so the lagging-hand read matches the
    // share grid's rows.
    tempoScale: number;
    daily?: number;
    title: string;
    ephemeral?: boolean;
    runSaved: "idle" | "saved" | "failed";
    onSaveTake: () => void;
}) {
    // Which hand trailed the other (null on a single-hand run), read at the same tempo
    // scale as the share grid so the readout matches its rows.
    const handVerdict = laggingHand(notes, { tempoScale });
    const hands = handsPlayed(notes);
    return (
        <>
            {!ephemeral &&
                (runSaved === "saved" ? (
                    <p className="text-sm text-success">{m.takes_saved()}</p>
                ) : runSaved === "failed" ? (
                    <p className="text-sm text-danger">{m.takes_save_failed()}</p>
                ) : (
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm text-muted">{m.takes_save_prompt()}</span>
                        <Button variant="primary" onClick={onSaveTake}>
                            {m.takes_save()}
                        </Button>
                    </div>
                ))}
            <div className="flex items-center gap-4 rounded-md border border-line p-3">
                <GradeLetter letter={grade.letter} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                    <dt className="text-muted">{m.scores_accuracy()}</dt>
                    <dd className="text-right font-mono tabular-nums">{grade.accuracy}%</dd>
                    <dt className="text-muted">{m.scores_timing()}</dt>
                    <dd className="text-right font-mono tabular-nums">{grade.timing}%</dd>
                    <dt className="text-muted">{m.scores_flow()}</dt>
                    <dd className="text-right font-mono tabular-nums">{grade.flow}%</dd>
                    {grade.dynamics !== null && (
                        <>
                            <dt className="text-faint">{m.scores_dynamics()}</dt>
                            <dd className="text-right font-mono tabular-nums text-muted">
                                {grade.dynamics}%
                            </dd>
                        </>
                    )}
                    {grade.expression !== null && (
                        <>
                            <dt className="text-faint">{m.scores_expression()}</dt>
                            <dd className="text-right font-mono tabular-nums text-muted">
                                {grade.expression}%
                            </dd>
                        </>
                    )}
                </dl>
            </div>
            <PerformanceStrip notes={notes} tolerance={tolerance} />
            {tempoCurve && (
                <section className="space-y-1">
                    <h3 className="text-sm font-medium text-muted">{m.tempo_heading()}</h3>
                    <TempoGraph
                        points={tempoCurve.points}
                        median={tempoCurve.median}
                        hotspots={tempoCurve.hotspots}
                    />
                </section>
            )}
            {handVerdict && (
                <p className="text-sm text-muted">
                    {handVerdict === "even"
                        ? m.hands_even()
                        : handVerdict === "left"
                          ? m.hand_left_lagged()
                          : m.hand_right_lagged()}
                </p>
            )}
            {grid && (
                <ShareCard
                    grid={grid}
                    caption={m.share_heading()}
                    gridLabel={m.share_grid_label()}
                    rowLabels={
                        hands.length > 1
                            ? hands.map((staff) => (staff === 0 ? m.hand_right() : m.hand_left()))
                            : [m.share_row_you()]
                    }
                    boast={
                        daily != null
                            ? m.daily_share_boast({ number: daily, grade: grade.letter })
                            : m.share_boast({ title })
                    }
                    heading={
                        daily != null
                            ? m.daily_share_boast({ number: daily, grade: grade.letter })
                            : title
                    }
                />
            )}
        </>
    );
}
