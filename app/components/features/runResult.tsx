// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type Grade, isOptionalReading, scoreReadings } from "../../../core/grade";
import { readingExplanation, readingLabel } from "../../lib/scoreReadingLabels";
import { Fragment } from "react";
import type { TempoCurve } from "../../../core/runOutcome";
import { laggingHand, type RunNote } from "../../../core/shareCard";
import { m } from "../../paraglide/messages.js";
import { Disclosure } from "../ui/disclosure";
import { Button } from "../ui/button";
import { GradeLetter } from "../ui/gradeLetter";
import { PerformanceStrip } from "../ui/performanceStrip";
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
    tempoCurve,
    tempoScale,
    ephemeral,
    runSaved,
    onSaveTake,
}: {
    grade: Grade;
    notes: RunNote[];
    tolerance: number;
    tempoCurve: TempoCurve | null;
    // Re-references the run to the piece's tempo so the lagging-hand read matches the
    // share grid's rows.
    tempoScale: number;
    ephemeral?: boolean;
    runSaved: "idle" | "saved" | "failed";
    onSaveTake: () => void;
}) {
    // Which hand trailed the other (null on a single-hand run), read at the same tempo
    // scale as the share grid so the readout matches its rows.
    const handVerdict = laggingHand(notes, { tempoScale });
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
                    {scoreReadings(grade).map(({ id, value }) => (
                        <Fragment key={id}>
                            <dt className={isOptionalReading(id) ? "text-faint" : "text-muted"}>
                                {readingLabel[id]()}
                            </dt>
                            <dd
                                className={`text-right font-mono tabular-nums ${
                                    isOptionalReading(id) ? "text-muted" : ""
                                }`}
                            >
                                {value}%
                            </dd>
                        </Fragment>
                    ))}
                </dl>
            </div>
            {/* The numbers are meaningless until somebody says what they measure, and a
                player who has just finished a run is exactly who wants to know. Folded away
                because it is read once and then known — the readouts themselves are what
                this panel is for. */}
            <Disclosure summary={m.scores_explain_toggle()}>
                <dl className="space-y-1 text-xs text-muted">
                    {scoreReadings(grade).map(({ id }) => (
                        <Fragment key={id}>
                            <dt className="font-medium text-body">{readingLabel[id]()}</dt>
                            <dd>{readingExplanation[id]()}</dd>
                        </Fragment>
                    ))}
                </dl>
                <p className="text-xs text-muted">{m.scores_explain_letter()}</p>
            </Disclosure>
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
        </>
    );
}
