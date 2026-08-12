// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { summarizeDynamics } from "./dynamics";
import { type ExpressionNote, summarizeExpression } from "./expressionGrade";
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
    // What the score asked of each of `pitches`, index-aligned: the standing dynamic with
    // that note's own accent (null where the score marks none), and how long that key is
    // meant to be down — its own written length narrowed by its own articulation. Absent
    // for a run with no engraved score behind it.
    //
    // Per pitch because a chord is not one note. A held bass under a staccato treble is
    // two instructions, and reading the position off its longest note grades the player
    // against a mark the score never put on the notes they were actually playing.
    expectedVelocities?: (number | null)[];
    expectedHoldsMs?: number[];
    // How hard each of `pitches` was struck, and how long each key was held, both
    // index-aligned with `pitches`.
    velocities?: number[];
    keyHoldsMs?: number[];
    // How much the timing windows are widened here, for a note whose moment the notation
    // leaves to the player — an ornament and the note it decorates. Zero everywhere else.
    slackMs?: number;
    // The score asks for the sustain pedal at this position. Under it a pianist releases
    // keys early on purpose and lets the damper hold the sound, so the key-hold length
    // carries no information about the length being played.
    pedalled?: boolean;
};

// One entry per KEY struck, not per position: a chord is several instructions played at
// once, and the expressive reading judges each of them. A position whose per-pitch record
// is missing — a run with no engraved score behind it, or a take recorded before there
// was one — contributes its position-level figures once, which is what there is to say
// about it.
function expressionNotes(notes: OutcomeNote[]): ExpressionNote[] {
    const out: ExpressionNote[] = [];
    for (const note of notes) {
        const expected = note.expectedVelocities;
        if (!expected) {
            out.push({
                velocity: note.velocity,
                keyHeldMs: note.keyHeldMs,
                expectedVelocity: null,
                expectedHoldMs: 0,
            });
            continue;
        }
        for (const [index] of expected.entries()) {
            out.push({
                velocity: note.velocities?.[index] ?? note.velocity,
                // Under the pedal the fingers are not what holds the note, so there is no
                // articulation here to be right or wrong about — reporting no hold leaves
                // it out of that half of the reading, which still measures the dynamics.
                keyHeldMs: note.pedalled ? undefined : note.keyHoldsMs?.[index] || note.keyHeldMs,
                expectedVelocity: expected[index] ?? null,
                expectedHoldMs: note.expectedHoldsMs?.[index] ?? 0,
            });
        }
    }
    return out;
}

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
    const hits = timingDeltas(notes).map((delta, index) =>
        makeHit(index, delta, tolerance, notes[index]?.slackMs ?? 0),
    );
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
            expressionNotes(notes),
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
