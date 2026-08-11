// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { summarizeDynamics } from "./dynamics";
import { summarizeExpression } from "./expressionGrade";
import { computeFlow } from "./flow";
import { computeGrade, type Grade } from "./grade";
import {
    LENIENT_TOLERANCE,
    makeHit,
    PRECISE_TOLERANCE,
    summarize,
    timingDeltas,
} from "./rhythm";
import { type Grid, handGrid, type RunNote } from "./shareCard";
import { findHotspots, type Hotspot, median, type TempoPoint, tempoSeries } from "./tempo";

// A cleared run note plus the velocity it was struck at — the raw record the whole outcome
// is derived from. The share grid, per-hand rows and per-note strip all read these fields.
export type OutcomeNote = RunNote & {
    velocity: number;
    // How long the note RANG, filled in from the MIDI note-off once the key is
    // released — or, under the sustain pedal, once the pedal lifts. Absent for
    // imprecise input, which reports no meaningful hold. This is what a replay needs.
    heldMs?: number;
    // How long the KEY was down, which under the pedal is a different and much shorter
    // figure. Articulation is judged on this one: a phrase played staccato under the
    // pedal is still played staccato, and dividing by the ringing length would read
    // every pedalled note as several times its written value.
    keyHeldMs?: number;
    // What the score asked for at this position: the standing dynamic with any accent
    // applied (null when the score marks none), and how long the note is meant to
    // sound — its written length narrowed by its articulation. Absent for a run with
    // no engraved score behind it.
    expectedVelocity?: number | null;
    expectedHoldMs?: number;
};

// The player's own pace read back out of the run, with the passages where they sped up or
// dragged; null when too few notes to plot a curve.
export type TempoCurve = { points: TempoPoint[]; median: number; hotspots: Hotspot[] };

// How the run's own tempo related to the piece's: 1 at the intended tempo, below it
// when slower. Speed is scored against this, so a careful crawl cannot read as an
// at-tempo performance.
//
// One definition because three readers have to agree on it. The grade's share grid is
// built with it, the results panel re-derives it to read the lagging hand at the same
// scale, and the run's sections are scored against it — and a piece with no intended
// tempo of its own falls back to the tempo it was played at, which is the one case
// where the three could quietly disagree.
export function tempoScale(runTempo: number, intendedTempo: number): number {
    return intendedTempo > 0 ? runTempo / intendedTempo : 1;
}

export type RunOutcome = {
    grade: Grade;
    // The timing leniency the run was graded at, kept so the per-note strip reads the same
    // windows as the grade and the share grid.
    tolerance: number;
    grid: Grid;
    tempoCurve: TempoCurve | null;
};

export type RunInput = {
    notes: OutcomeNote[];
    correct: number;
    wrong: number;
    // Whether any note came from imprecise input (on-screen or computer keyboard). Those
    // can't tap a true rhythm, so the run's timing is graded with widened windows rather
    // than flooring a touch player — the primary input — at zero.
    imprecise: boolean;
    // The piece's own tempo, the speed Speed is scored against, so a slow run reads slow
    // however the practice slider was set; and the tempo the run was actually matched at.
    // With no intrinsic tempo the scale is 1, leaving Speed to measure how evenly the
    // notated rhythm was kept.
    intendedTempo: number;
    runTempo: number;
};

// Derive everything a finished run shows and records — the grade, the timing tolerance it
// was judged at, the per-hand share grid, and the tempo curve — from the raw played notes.
// Pure: the same run always grades the same, whatever the UI around it, so the whole
// scoring path is unit- and property-testable without a score on screen.
export function deriveRunOutcome({
    notes,
    correct,
    wrong,
    imprecise,
    intendedTempo,
    runTempo,
}: RunInput): RunOutcome {
    const velocities = notes.map((note) => note.velocity);
    // A run with no real velocity variation (the computer keyboard) is graded without
    // dynamics rather than crediting a constant.
    const hasDynamics = new Set(velocities).size > 1;
    const tolerance = imprecise ? LENIENT_TOLERANCE : PRECISE_TOLERANCE;
    const hits = timingDeltas(notes).map((delta, index) => makeHit(index, delta, tolerance));
    const grade = computeGrade({
        correct,
        wrong,
        rhythm: summarize(hits),
        flow: computeFlow(notes),
        dynamics: hasDynamics ? summarizeDynamics(velocities) : null,
        // Every note carries what the score asked for at its position, so the
        // expressive reading needs no second walk of the engraved score. It returns
        // null by itself when there is nothing to measure.
        expression: summarizeExpression(
            notes.map((note) => ({
                velocity: note.velocity,
                keyHeldMs: note.keyHeldMs,
                expectedVelocity: note.expectedVelocity ?? null,
                expectedHoldMs: note.expectedHoldMs ?? 0,
            })),
            imprecise ? "imprecise" : "precise",
        ),
    });
    // Timing is judged against the player's own pace (so a steady run at any tempo reads as
    // in time); the scale re-references the run to the piece's tempo for the share grid.
    const scale = tempoScale(runTempo, intendedTempo);
    const grid = handGrid(notes, { tempoScale: scale });
    const points = tempoSeries(
        runTempo,
        notes.map((note) => note.targetMs),
        notes.map((note) => note.playedMs),
    );
    const med = median(points.map((point) => point.bpm));
    const tempoCurve =
        points.length > 0 ? { points, median: med, hotspots: findHotspots(points, med) } : null;
    return { grade, tolerance, grid, tempoCurve };
}
