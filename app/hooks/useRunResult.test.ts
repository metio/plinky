// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DailyResult } from "../../core/daily";
import { PRECISE_TOLERANCE } from "../../core/rhythm";
import type { RunOutcome } from "./useRunResult";
import { useRunResult } from "./useRunResult";

const outcome: RunOutcome = {
    grade: { accuracy: 90, timing: 80, flow: 70, dynamics: null, score: 82, letter: "B" },
    notes: [{ targetMs: 0, playedMs: 0, wrongBefore: 0, staves: [0] }],
    tolerance: 2,
    grid: [["best", "good"]],
    tempoCurve: null,
};

describe("useRunResult", () => {
    it("starts empty with no seed", () => {
        const { result } = renderHook(() => useRunResult());
        expect(result.current.grade).toBeNull();
        expect(result.current.notes).toEqual([]);
        expect(result.current.grid).toBeNull();
        expect(result.current.saved).toBe("idle");
        expect(result.current.tolerance).toBe(PRECISE_TOLERANCE);
    });

    it("seeds the grade, notes, grid and tolerance from a saved daily result", () => {
        const seeded: DailyResult = {
            grade: outcome.grade,
            notes: outcome.notes,
            grid: outcome.grid,
            tolerance: 3,
        };
        const { result } = renderHook(() => useRunResult(seeded));
        expect(result.current.grade?.letter).toBe("B");
        expect(result.current.notes).toHaveLength(1);
        expect(result.current.grid).toEqual([["best", "good"]]);
        expect(result.current.tolerance).toBe(3);
    });

    it("records a finished run's outcome into every surface", () => {
        const { result } = renderHook(() => useRunResult());
        act(() => result.current.record(outcome));
        expect(result.current.grade?.letter).toBe("B");
        expect(result.current.notes).toEqual(outcome.notes);
        expect(result.current.tolerance).toBe(2);
        expect(result.current.grid).toEqual(outcome.grid);
    });

    it("marks the save verdict from the store's write result", () => {
        const { result } = renderHook(() => useRunResult());
        act(() => result.current.markSaved(true));
        expect(result.current.saved).toBe("saved");
        act(() => result.current.markSaved(false));
        expect(result.current.saved).toBe("failed");
    });

    it("clears every surface back to no-result, so a stale result can't linger", () => {
        const { result } = renderHook(() => useRunResult());
        act(() => {
            result.current.record(outcome);
            result.current.markSaved(true);
        });
        expect(result.current.grade).not.toBeNull();
        act(() => result.current.clear());
        expect(result.current.grade).toBeNull();
        expect(result.current.notes).toEqual([]);
        expect(result.current.grid).toBeNull();
        expect(result.current.tempoCurve).toBeNull();
        expect(result.current.saved).toBe("idle");
    });
});
