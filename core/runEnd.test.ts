// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { owesGrade, runSettled } from "./runEnd";

describe("runSettled", () => {
    it("settles a finished run once every key is up", () => {
        expect(runSettled({ complete: true, holdingNote: false })).toBe(true);
    });

    it("waits while the final note is still held", () => {
        expect(runSettled({ complete: true, holdingNote: true })).toBe(false);
    });

    it("never settles a run that has not finished, held or not", () => {
        expect(runSettled({ complete: false, holdingNote: false })).toBe(false);
        expect(runSettled({ complete: false, holdingNote: true })).toBe(false);
    });
});

describe("owesGrade", () => {
    const finished = { complete: true, graded: false, cleared: 8, captured: 8 };

    it("owes a finished, ungraded run its grade", () => {
        expect(owesGrade(finished)).toBe(true);
    });

    it("owes nothing once the run is graded", () => {
        expect(owesGrade({ ...finished, graded: true })).toBe(false);
    });

    it("owes nothing to a run still being played", () => {
        expect(owesGrade({ ...finished, complete: false })).toBe(false);
    });

    it("refuses cleared positions with no notes captured to grade them from", () => {
        expect(owesGrade({ ...finished, captured: 0 })).toBe(false);
    });

    it("still grades a run that cleared nothing", () => {
        expect(owesGrade({ ...finished, cleared: 0, captured: 0 })).toBe(true);
    });
});
