// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useState } from "react";
import type { DailyResult } from "../../core/daily";
import type { Grade } from "../../core/grade";
import { PRECISE_TOLERANCE } from "../../core/rhythm";
import type { TempoCurve } from "../../core/runOutcome";
import type { Grid, RunNote } from "../../core/shareCard";

// A finished run's derived outcome — everything the result panel shows, all a pure
// function of the played notes (deriveRunOutcome produces it; this hook only holds it).
export type RunOutcome = {
    grade: Grade;
    notes: RunNote[];
    tolerance: number;
    grid: Grid;
    // A run with no timing spread (a single note) yields no curve.
    tempoCurve: TempoCurve | null;
};

// The self-paced run's result surfaces and the logic that fills and clears them, held
// together so the play surface reads and wipes them as one unit.
export type RunResult = {
    // The grade, or null before any run finishes (and once cleared).
    grade: Grade | null;
    notes: RunNote[];
    // The timing leniency the run was graded at, so the per-note strip reads the same
    // windows as the grade and share grid.
    tolerance: number;
    grid: Grid | null;
    tempoCurve: TempoCurve | null;
    // idle until the player saves the run as a take, then the store's write verdict.
    saved: "idle" | "saved" | "failed";
    // Record a finished run's outcome — the grade panel and its readouts follow from it.
    record(outcome: RunOutcome): void;
    // Set the save verdict from the store's write result (a refused write reads "failed").
    markSaved(stored: boolean): void;
    // Wipe every surface back to "no result yet" — a fresh run and a keep-up run both
    // call this so a finished result can't linger beneath the next run.
    clear(): void;
};

// A finished daily re-opened on mount seeds the grade, notes, grid and tolerance so the
// result shows straight away; the tempo curve is only produced by a live run, so it
// starts empty regardless of the seed.
export function useRunResult(seeded?: DailyResult | null): RunResult {
    const [grade, setGrade] = useState<Grade | null>(seeded?.grade ?? null);
    const [notes, setNotes] = useState<RunNote[]>(seeded?.notes ?? []);
    const [tolerance, setTolerance] = useState(seeded?.tolerance ?? PRECISE_TOLERANCE);
    const [grid, setGrid] = useState<Grid | null>(seeded?.grid ?? null);
    const [tempoCurve, setTempoCurve] = useState<TempoCurve | null>(null);
    const [saved, setSaved] = useState<"idle" | "saved" | "failed">("idle");

    const record = useCallback((outcome: RunOutcome) => {
        setGrade(outcome.grade);
        setNotes(outcome.notes);
        setTolerance(outcome.tolerance);
        setGrid(outcome.grid);
        setTempoCurve(outcome.tempoCurve);
    }, []);

    const markSaved = useCallback((stored: boolean) => {
        setSaved(stored ? "saved" : "failed");
    }, []);

    const clear = useCallback(() => {
        setSaved("idle");
        setGrade(null);
        setNotes([]);
        setGrid(null);
        setTempoCurve(null);
    }, []);

    return { grade, notes, tolerance, grid, tempoCurve, saved, record, markSaved, clear };
}
