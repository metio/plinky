// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { summarizeDynamics } from "./dynamics";
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
export type OutcomeNote = RunNote & { velocity: number };

// The player's own pace read back out of the run, with the passages where they sped up or
// dragged; null when too few notes to plot a curve.
export type TempoCurve = { points: TempoPoint[]; median: number; hotspots: Hotspot[] };

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
    });
    // Timing is judged against the player's own pace (so a steady run at any tempo reads as
    // in time); the scale re-references the run to the piece's tempo for the share grid.
    const scale = intendedTempo > 0 ? runTempo / intendedTempo : 1;
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
