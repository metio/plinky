// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Grade } from "../../../core/grade";
import type { RunNote } from "../../../core/shareCard";
import { m } from "../../paraglide/messages.js";
import { RunResult } from "./runResult";

afterEach(cleanup);

const grade = (over: Partial<Grade> = {}): Grade => ({
    accuracy: 92,
    timing: 88,
    flow: 80,
    dynamics: null,
    score: 86,
    letter: "B",
    ...over,
});

// A single-hand run (all treble), so the lagging-hand verdict stays null and the tests
// below read the grade and save flow without depending on laggingHand's banding.
const notes: RunNote[] = [
    { targetMs: 0, playedMs: 0, wrongBefore: 0, staves: [0] },
    { targetMs: 500, playedMs: 520, wrongBefore: 0, staves: [0] },
];

const base = {
    notes,
    tolerance: 1,
    grid: null,
    tempoCurve: null,
    tempoScale: 1,
    title: "Minuet",
    runSaved: "idle" as const,
    onSaveTake: () => {},
};

describe("RunResult", () => {
    it("shows the grade letter and its accuracy/timing/flow breakdown", () => {
        render(<RunResult {...base} grade={grade()} />);
        expect(screen.getByText("B")).toBeTruthy();
        expect(screen.getByText("92%")).toBeTruthy();
        expect(screen.getByText("88%")).toBeTruthy();
        expect(screen.getByText("80%")).toBeTruthy();
    });

    it("shows the dynamics row only when the run scored dynamics", () => {
        const { rerender } = render(<RunResult {...base} grade={grade({ dynamics: null })} />);
        expect(screen.queryByText(m.scores_dynamics())).toBeNull();
        rerender(<RunResult {...base} grade={grade({ dynamics: 70 })} />);
        expect(screen.getByText(m.scores_dynamics())).toBeTruthy();
        expect(screen.getByText("70%")).toBeTruthy();
    });

    it("prompts to save the run, and reports the request through onSaveTake", () => {
        const onSaveTake = vi.fn();
        render(<RunResult {...base} grade={grade()} onSaveTake={onSaveTake} />);
        fireEvent.click(screen.getByText(m.takes_save()));
        expect(onSaveTake).toHaveBeenCalledOnce();
    });

    it("replaces the prompt with a confirmation once the run is saved", () => {
        render(<RunResult {...base} grade={grade()} runSaved="saved" />);
        expect(screen.getByText(m.takes_saved())).toBeTruthy();
        expect(screen.queryByText(m.takes_save())).toBeNull();
    });

    it("reports a failed save", () => {
        render(<RunResult {...base} grade={grade()} runSaved="failed" />);
        expect(screen.getByText(m.takes_save_failed())).toBeTruthy();
    });

    it("offers no save for an ephemeral piece, which can't be saved", () => {
        render(<RunResult {...base} grade={grade()} ephemeral />);
        expect(screen.queryByText(m.takes_save())).toBeNull();
        expect(screen.queryByText(m.takes_save_prompt())).toBeNull();
    });
});
