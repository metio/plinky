// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { History } from "../../../core/history";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { choose, chosen } from "../../testing/controls";
import { GoingBlock } from "./goingBlock";

afterEach(cleanup);

// A Wednesday, so "this week" is a real window rather than today alone.
const NOW = new Date("2026-08-19T10:00:00");

const HISTORY: History = {
    "2025-06-02": 500,
    "2026-01-05": 300,
    "2026-08-01": 100,
    "2026-08-17": 40,
    "2026-08-19": 900,
};

const SUMMARY = {
    totalNotes: 1840,
    daysPracticed: 5,
    recent: Array.from({ length: 7 }, (_, at) => ({
        date: `2026-08-${13 + at}`,
        notes: at * 10,
    })),
};

const mount = (history: History = HISTORY) =>
    renderWithServices(
        <GoingBlock history={history} summary={SUMMARY} pieceTitle={(id) => id} now={NOW} />,
    );

describe("the block behind the period dial", () => {
    it("opens on the month, which is what checking in on yourself means", () => {
        mount();
        expect(chosen(m.scope_label)).toBe(m.scope_month());
        // August: the 1st, the 17th and the 19th.
        expect(screen.getByText("1,040")).toBeTruthy();
    });

    it("re-reads every figure when the dial moves", () => {
        mount();
        choose(m.scope_label, m.scope_week);
        // The 17th and the 19th only — the 1st is in the same month but not the same week.
        expect(screen.getByText("940")).toBeTruthy();
        choose(m.scope_label, m.scope_all);
        expect(screen.getByText("1,840")).toBeTruthy();
    });

    it("shows the seven-day chart only for the week it describes", () => {
        // Seven bars answer "which days this week", a question only the week has. Over a
        // month they would be a chart of the wrong seven days.
        mount();
        expect(screen.queryByText(m.progress_last_7_days())).toBeNull();
        choose(m.scope_label, m.scope_week);
        expect(screen.getByText(m.progress_last_7_days())).toBeTruthy();
    });

    it("says nothing at all before anything has been played", () => {
        // A pair of zeros in a proud gradient is a frame promising insight it does not have.
        mount({});
        expect(screen.queryByText(m.progress_notes_played())).toBeNull();
        // An empty WINDOW is different and keeps its zeros: "nothing this week" is a real
        // answer, so the dial is still there to ask with.
        expect(chosen(m.scope_label)).toBe(m.scope_month());
    });

    it("keeps its zeros for a window that happens to be empty", () => {
        // Practice long ago but none this month: the tile stays and reports the nothing,
        // which is not the same as never having played at all.
        mount({ "2025-06-02": 500 });
        choose(m.scope_label, m.scope_month);
        expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    });

    it("draws no heading of its own — the question above it is the heading", () => {
        // Two headings for one thing is what made the page read as a stack of sections
        // rather than a set of answers.
        const { container } = mount();
        expect(container.querySelector("h2")).toBeNull();
    });
});
