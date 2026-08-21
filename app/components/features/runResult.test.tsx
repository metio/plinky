// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
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
    expression: null,
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
        // Named twice when it is shown: once as the reading, once in the panel that says
        // what the reading means — and not at all when there is nothing to read.
        const { rerender } = render(<RunResult {...base} grade={grade({ dynamics: null })} />);
        expect(screen.queryAllByText(m.scores_dynamics())).toHaveLength(0);
        rerender(<RunResult {...base} grade={grade({ dynamics: 70 })} />);
        expect(screen.getAllByText(m.scores_dynamics())).toHaveLength(2);
        expect(screen.getByText("70%")).toBeTruthy();
    });

    it("says what each of the numbers measures", () => {
        // A score nobody explains is a number to be anxious about rather than something to
        // read. Folded away, because it is read once and then known.
        render(<RunResult {...base} grade={grade()} />);
        expect(screen.getByText(m.scores_explain_toggle())).toBeTruthy();
        expect(screen.getByText(m.scores_explain_accuracy())).toBeTruthy();
        expect(screen.getByText(m.scores_explain_letter())).toBeTruthy();
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
