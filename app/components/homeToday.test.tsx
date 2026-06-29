// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GradeCatalogItem, GradedMastery } from "../lib/gradeProgress";
import { HomeToday } from "./homeToday";

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

describe("HomeToday", () => {
    it("shows what to do today, suggesting the gentlest unmastered piece", async () => {
        masteryMock.mockResolvedValue([]); // brand-new player, Grade 0
        catalogueMock.mockResolvedValue([
            { id: "g1-easy", title: "First Steps", grade: 1, cost: 1 },
        ]);

        render(
            <MemoryRouter>
                <HomeToday />
            </MemoryRouter>,
        );

        // The daily and a piece to learn surface as one-tap links.
        expect(await screen.findByText("Today")).toBeTruthy();
        // The title is quoted so a lowercase title doesn't read as a run-on sentence.
        const learn = await screen.findByRole("link", { name: /Learn “First Steps”/ });
        expect(learn.getAttribute("href")).toContain("/play/g1-easy");
        expect(screen.getByRole("link", { name: /daily challenge/i })).toBeTruthy();
    });
});
