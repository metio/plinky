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

const mount = (history: History = HISTORY, now: Date = NOW) =>
    renderWithServices(<GoingBlock history={history} pieceTitle={(id) => id} now={now} />);

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

    it("shows the week's bars only for the week it describes", () => {
        // The bars answer "which days this week", a question only the week has. Over a
        // month they would be a chart of the wrong days.
        const { container } = mount();
        expect(container.querySelector(".bg-chart-peak")).toBeNull();
        choose(m.scope_label, m.scope_week);
        // Wednesday: Monday, Tuesday and today.
        expect(container.querySelectorAll(".bg-chart-peak")).toHaveLength(3);
    });

    it("draws the same week the tile counts, not the last seven days", () => {
        // A Monday after six full days: the tile says nothing this week, and the bars
        // under it must agree rather than show six bars from last week.
        const history: History = {
            "2026-08-18": 100,
            "2026-08-19": 100,
            "2026-08-20": 100,
            "2026-08-21": 100,
            "2026-08-22": 100,
            "2026-08-23": 100,
        };
        const { container } = mount(history, new Date("2026-08-24T10:00:00"));
        choose(m.scope_label, m.scope_week);
        const labels = [...container.querySelectorAll("span.text-xs")].map(
            (span) => span.textContent,
        );
        expect(labels.filter((label) => /^\d\d-\d\d$/.test(label ?? ""))).toEqual(["08-24"]);
        const bars = [...container.querySelectorAll(".bg-chart-peak")] as HTMLElement[];
        expect(bars).toHaveLength(1);
        expect(bars[0]?.style.height).toBe("0%");
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
