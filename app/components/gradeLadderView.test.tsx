// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GradeCatalogItem, GradedMastery } from "../lib/gradeProgress";
import type { Mastery } from "../lib/mastery";
import { GradeLadderView } from "./gradeLadderView";

const { masteryMock, catalogueMock } = vi.hoisted(() => ({
    masteryMock: vi.fn<() => Promise<GradedMastery[]>>(),
    catalogueMock: vi.fn<() => Promise<GradeCatalogItem[]>>(),
}));
vi.mock("../lib/gradeProgress", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../lib/gradeProgress")>()),
    loadGradedMastery: masteryMock,
    loadGradeCatalogue: catalogueMock,
}));

afterEach(() => {
    cleanup();
    masteryMock.mockReset();
    catalogueMock.mockReset();
    localStorage.clear();
});

const fresh: Mastery = {
    bestScore: 80,
    learned: true,
    backlog: false,
    intervalDays: 10,
    reviewAt: Date.now() + 86_400_000,
    updatedAt: 0,
};

describe("GradeLadderView", () => {
    it("shows the current grade and suggests the next grade's gentlest pieces", async () => {
        // Five mastered in grade 1 → Grade 1; grade 2 holds two unmastered pieces.
        masteryMock.mockResolvedValue(
            Array.from({ length: 5 }, (_, i) => ({
                id: `g1-${i}`,
                title: `g1-${i}`,
                grade: 1,
                cost: 1,
                mastery: fresh,
            })),
        );
        catalogueMock.mockResolvedValue([
            { id: "g2-hard", title: "Harder Two", grade: 2, cost: 3 },
            { id: "g2-easy", title: "Gentle Two", grade: 2, cost: 1 },
        ]);

        render(
            <MemoryRouter>
                <GradeLadderView />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Grade 1")).toBeTruthy();
        // Working grade is the one above the current standing.
        expect(await screen.findByText("Up next in Grade 2")).toBeTruthy();
        // Suggestions are easiest-first.
        const suggestions = await screen.findByRole("link", { name: "Gentle Two" });
        expect(suggestions).toBeTruthy();
    });

    it("guides a brand-new Grade-0 player with the first-steps checklist", async () => {
        masteryMock.mockResolvedValue([]); // nothing mastered → Grade 0
        catalogueMock.mockResolvedValue([{ id: "g1", title: "First Piece", grade: 1, cost: 1 }]);

        render(
            <MemoryRouter>
                <GradeLadderView />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Getting started")).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "Set your hand size for tailored fingering" }),
        ).toBeTruthy();
    });
});
