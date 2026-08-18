// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Mastery } from "../../../core/mastery";
import type { GradedMastery } from "../../lib/gradeProgress";
import { GradeRoadmap } from "./gradeRoadmap";

afterEach(cleanup);

const NOW = 1_700_000_000_000;

const fresh: Mastery = {
    bestScore: 80,
    learned: true,
    backlog: false,
    intervalDays: 10,
    reviewAt: NOW + 86_400_000,
    updatedAt: 0,
    deadline: "",
};

const items: GradedMastery[] = Array.from({ length: 5 }, (_, i) => ({
    id: `g1-${i}`,
    title: `g1-${i}`,
    grade: 1,
    cost: 1,
    kind: "piece",
    mastery: fresh,
}));

describe("GradeRoadmap", () => {
    it("renders a row per grade, each opening its own pieces", () => {
        render(
            <MemoryRouter>
                <GradeRoadmap items={items} level={1} mode="gentle" now={NOW} />
            </MemoryRouter>,
        );
        // All eight grades are on the roadmap.
        for (const grade of [1, 8]) {
            expect(screen.getByText(`Grade ${grade}`)).toBeTruthy();
        }
        // The whole point of the row: a grade you have not reached still opens its
        // shelf, because nothing here is locked.
        const eighth = screen.getByText("Grade 8").closest("a");
        expect(eighth?.getAttribute("href")).toContain("music/?grade=8");
        // Five fresh pieces earn the bronze star.
        expect(screen.getByRole("img", { name: "Bronze" })).toBeTruthy();
        // Every row carries the optional go-deeper line.
        expect(screen.getAllByText("About this grade")).toHaveLength(8);
    });

    it("prints no mastered-of-pool ratio", () => {
        // Four hundred pieces a grade is not a target, and printing "3 / 447" beside a
        // star turns a shelf into a requirement.
        render(
            <MemoryRouter>
                <GradeRoadmap items={items} level={1} mode="gentle" now={NOW} />
            </MemoryRouter>,
        );
        expect(screen.queryByText(/\/\s*10/)).toBeNull();
    });

    it("highlights the current grade's row", () => {
        render(
            <MemoryRouter>
                <GradeRoadmap items={items} level={1} mode="gentle" now={NOW} />
            </MemoryRouter>,
        );
        const current = screen.getByText("Grade 1").closest("li");
        const other = screen.getByText("Grade 2").closest("li");
        expect(current?.className).toContain("border-accent-line-strong");
        expect(other?.className).not.toContain("border-accent-line-strong");
    });
});
