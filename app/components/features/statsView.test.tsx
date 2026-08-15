// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "../../adapters/memoryStore";
import { createHistoryStore } from "../../stores/historyStore";
import { renderWithServices } from "../../testing/renderWithServices";
import type { GradeCatalogItem, GradedMastery } from "../../lib/gradeProgress";
import type { Mastery } from "../../../core/mastery";
import { StatsView } from "./statsView";
import { m } from "../../paraglide/messages.js";

const { masteryMock, catalogueMock } = vi.hoisted(() => ({
    masteryMock: vi.fn<() => Promise<GradedMastery[]>>(),
    catalogueMock: vi.fn<() => Promise<GradeCatalogItem[]>>(),
}));
vi.mock("../../lib/gradeProgress", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../lib/gradeProgress")>()),
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
    deadline: "",
};

describe("StatsView", () => {
    it("shows standing, activity stats, and the next grade's gentlest pieces", async () => {
        masteryMock.mockResolvedValue(
            Array.from({ length: 5 }, (_, i) => ({
                id: `g1-${i}`,
                title: `g1-${i}`,
                grade: 1,
                cost: 1,
                kind: "piece",
                mastery: fresh,
            })),
        );
        catalogueMock.mockResolvedValue([
            { id: "g2-hard", title: "Harder Two", grade: 2, cost: 3, kind: "piece" },
            { id: "g2-easy", title: "Gentle Two", grade: 2, cost: 1, kind: "piece" },
        ]);

        render(
            <MemoryRouter>
                <StatsView />
            </MemoryRouter>,
        );

        // The gentlest next-grade piece confirms the page resolved.
        expect(await screen.findByRole("link", { name: "Gentle Two" })).toBeTruthy();
        // Standing (Grade 1 shows in the headline and the roadmap row) and the
        // retrospective stats merged in from /progress.
        expect(screen.getAllByText("Grade 1").length).toBeGreaterThan(0);
    });

    it("counts the days and the notes once there are some", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([
            { id: "g1", title: "First Piece", grade: 1, cost: 1, kind: "piece" },
        ]);
        const kv = memoryStore();
        createHistoryStore(kv).record(240);

        renderWithServices(
            <MemoryRouter>
                <StatsView />
            </MemoryRouter>,
            { store: kv },
        );

        expect(await screen.findByRole("link", { name: "First Piece" })).toBeTruthy();
        expect(screen.getAllByText(m.progress_days_practiced()).length).toBeGreaterThan(0);
    });

    it("says nothing about days and notes before anything has been played", async () => {
        // A pair of zeros over an empty week is a frame promising insight it does not
        // have; the practice diary further down says it in a sentence, with what to do.
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([
            { id: "g1", title: "First Piece", grade: 1, cost: 1, kind: "piece" },
        ]);

        render(
            <MemoryRouter>
                <StatsView />
            </MemoryRouter>,
        );

        expect(await screen.findByRole("link", { name: "First Piece" })).toBeTruthy();
        expect(screen.queryByText(m.progress_days_practiced())).toBeNull();
    });

    it("no longer carries the discovery checklist — it lives on the home page now", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([
            { id: "g1", title: "First Piece", grade: 1, cost: 1, kind: "piece" },
        ]);

        render(
            <MemoryRouter>
                <StatsView />
            </MemoryRouter>,
        );

        expect(await screen.findByRole("link", { name: "First Piece" })).toBeTruthy();
        expect(screen.queryByText("Getting started")).toBeNull();
    });
});

describe("the standing key", () => {
    it("says what a grade and a skill actually are", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([]);
        renderWithServices(
            <MemoryRouter>
                <StatsView />
            </MemoryRouter>,
        );
        await screen.findByText(m.stats_grade_help());
        // They were explained in a title attribute, which a touch screen cannot open.
        expect(screen.getByText(m.stats_grade_help())).toBeTruthy();
        expect(screen.getByText(m.grades_skill_help())).toBeTruthy();
        expect(document.querySelector("[title]")).toBeNull();
    });
});
