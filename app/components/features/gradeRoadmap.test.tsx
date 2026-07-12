// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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
};

const items: GradedMastery[] = Array.from({ length: 5 }, (_, i) => ({
    id: `g1-${i}`,
    title: `g1-${i}`,
    grade: 1,
    cost: 1,
    mastery: fresh,
}));

describe("GradeRoadmap", () => {
    it("renders a row per grade with the pool count and the earned star", () => {
        render(
            <GradeRoadmap
                items={items}
                level={1}
                mode="gentle"
                now={NOW}
                poolSizes={new Map([[1, 10]])}
            />,
        );
        // All eight grades are on the roadmap.
        for (const grade of [1, 8]) {
            expect(screen.getByText(`Grade ${grade}`)).toBeTruthy();
        }
        // Five fresh pieces of ten: the mastered count and the bronze star.
        expect(screen.getByText("5 / 10")).toBeTruthy();
        expect(screen.getByRole("img", { name: "Bronze" })).toBeTruthy();
        // Every row carries the optional go-deeper line.
        expect(screen.getAllByText("About this grade")).toHaveLength(8);
    });

    it("highlights the current grade's row", () => {
        render(
            <GradeRoadmap items={items} level={1} mode="gentle" now={NOW} poolSizes={new Map()} />,
        );
        const current = screen.getByText("Grade 1").closest("li");
        const other = screen.getByText("Grade 2").closest("li");
        expect(current?.className).toContain("border-indigo-300");
        expect(other?.className).not.toContain("border-indigo-300");
    });
});
