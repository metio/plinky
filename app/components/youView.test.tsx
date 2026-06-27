// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GradeCatalogItem, GradedMastery } from "../lib/gradeProgress";
import type { Mastery } from "../lib/mastery";
import { YouView } from "./youView";

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

describe("YouView", () => {
    it("shows standing, activity stats, and the next grade's gentlest pieces", async () => {
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
                <YouView />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Grade 1")).toBeTruthy();
        // The retrospective stats merged in from /progress.
        expect(screen.getByText(/day streak/i)).toBeTruthy();
        expect(await screen.findByRole("link", { name: "Gentle Two" })).toBeTruthy();
    });

    it("guides a brand-new Grade-0 player with the first-steps checklist", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([{ id: "g1", title: "First Piece", grade: 1, cost: 1 }]);

        render(
            <MemoryRouter>
                <YouView />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Getting started")).toBeTruthy();
    });
});
