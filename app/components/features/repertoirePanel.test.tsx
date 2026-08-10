// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { type Mastery, normalizeMastery } from "../../../core/mastery";
import type { GradedMastery } from "../../lib/gradeProgress";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { RepertoirePanel } from "./repertoirePanel";

afterEach(cleanup);

const DAY_MS = 86_400_000;
const NOW = new Date(2026, 5, 23, 12, 0);

function item(id: string, title: string, mastery: Partial<Mastery>): GradedMastery {
    return {
        id,
        title,
        grade: 2,
        cost: 10,
        kind: "piece",
        mastery: normalizeMastery(mastery),
    };
}

function mount(items: GradedMastery[]) {
    const view = renderWithServices(
        <MemoryRouter>
            <RepertoirePanel items={items} now={NOW} />
        </MemoryRouter>,
    );
    for (const one of items) {
        view.services.mastery.save(one.id, one.mastery);
    }
    return view;
}

describe("RepertoirePanel", () => {
    it("shows nothing at all when nothing is being worked on", () => {
        const { container } = mount([item("fresh", "Fresh", { bestScore: 0 })]);
        expect(container.textContent).toBe("");
    });

    it("names the stage a piece has reached", () => {
        mount([
            item("new", "New one", { bestScore: 40 }),
            item("kept", "Old friend", {
                learned: true,
                intervalDays: 60,
                reviewAt: NOW.getTime() + 60 * DAY_MS,
            }),
        ]);
        expect(screen.getByText(m.repertoire_stage_learning())).toBeTruthy();
        expect(screen.getByText(m.repertoire_stage_maintenance())).toBeTruthy();
    });

    it("puts a dated piece above an undated one and says how far off it is", () => {
        mount([
            item("undated", "Undated", { bestScore: 40 }),
            item("exam", "Exam piece", { bestScore: 40, deadline: "2026-06-30" }),
        ]);
        const titles = screen.getAllByRole("link").map((link) => link.textContent);
        expect(titles).toEqual(["Exam piece", "Undated"]);
        expect(
            screen.getByText(m.repertoire_days_left({ date: "2026-06-30", count: 7 })),
        ).toBeTruthy();
    });

    it("says plainly when a date has gone by, without reproaching", () => {
        mount([item("late", "Late one", { bestScore: 40, deadline: "2026-06-01" })]);
        expect(screen.getByText(m.repertoire_date_passed({ date: "2026-06-01" }))).toBeTruthy();
    });

    it("marks a learned piece left well past its review", () => {
        mount([
            item("rusty", "Rusty", {
                learned: true,
                intervalDays: 4,
                reviewAt: NOW.getTime() - 20 * DAY_MS,
            }),
        ]);
        expect(screen.getByText(m.repertoire_slipping())).toBeTruthy();
    });

    it("stores a date the player picks, and clears it again", () => {
        const { services } = mount([item("piece", "A piece", { bestScore: 40 })]);
        const input = screen.getByLabelText(m.repertoire_deadline());
        fireEvent.change(input, { target: { value: "2026-07-04" } });
        expect(services.mastery.load("piece")?.deadline).toBe("2026-07-04");

        fireEvent.change(screen.getByLabelText(m.repertoire_deadline()), { target: { value: "" } });
        expect(services.mastery.load("piece")?.deadline).toBe("");
    });

    it("leaves the review schedule alone when a date is set", () => {
        const reviewAt = NOW.getTime() + 3 * DAY_MS;
        const { services } = mount([
            item("piece", "A piece", { learned: true, intervalDays: 3, reviewAt }),
        ]);
        fireEvent.change(screen.getByLabelText(m.repertoire_deadline()), {
            target: { value: "2026-07-04" },
        });
        expect(services.mastery.load("piece")?.reviewAt).toBe(reviewAt);
    });
});
