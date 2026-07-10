// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeAssignment } from "../../../core/assignment";
import { markLearned } from "../../../core/mastery";
import type { GradeCatalogItem, GradedMastery } from "../../lib/gradeProgress";
import { loadBundledScores } from "../../lib/catalog";
import { renderWithServices } from "../../testing/renderWithServices";
import { HomeToday } from "./homeToday";

const { masteryMock, catalogueMock } = vi.hoisted(() => ({
    masteryMock: vi.fn<() => Promise<GradedMastery[]>>(),
    catalogueMock: vi.fn<() => Promise<GradeCatalogItem[]>>(),
}));
vi.mock("../../lib/gradeProgress", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../lib/gradeProgress")>()),
    loadGradedMastery: masteryMock,
    loadGradeCatalogue: catalogueMock,
}));

// The starter assignment is only built from the exercise manifest + bundled
// demos; an empty manifest keeps it to the demos, whose ids the tests can name.
const exercises = { manifest: () => Promise.resolve([]) };

afterEach(() => {
    cleanup();
    masteryMock.mockReset();
    catalogueMock.mockReset();
});

const mount = (overrides = {}) =>
    renderWithServices(
        <MemoryRouter>
            <HomeToday />
        </MemoryRouter>,
        // biome-ignore lint/suspicious/noExplicitAny: a partial exercise source is all the panel reads
        { exercises: exercises as any, ...overrides },
    );

describe("HomeToday", () => {
    it("hands a brand-new player the starter assignment's first step", async () => {
        masteryMock.mockResolvedValue([]); // brand-new player, Grade 0
        catalogueMock.mockResolvedValue([
            { id: "g1-easy", title: "First Steps Song", grade: 1, cost: 1 },
        ]);
        mount();
        expect(await screen.findByText("Today")).toBeTruthy();
        // The guided path outranks the generated suggestion, and its link goes
        // straight into the current step's play page.
        const cont = await screen.findByRole("link", { name: /Continue “First steps”/ });
        expect(cont.getAttribute("href")).toContain(`/play/${loadBundledScores()[0]?.id}`);
        expect(cont.textContent).toContain("step 1 of");
        expect(screen.queryByRole("link", { name: /Learn “/ })).toBeNull();
        expect(screen.getByRole("link", { name: /daily challenge/i })).toBeTruthy();
    });

    it("returns to the gentlest suggestion once the starter is finished", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([
            { id: "g1-easy", title: "First Steps Song", grade: 1, cost: 1 },
        ]);
        const { services } = mount();
        for (const score of loadBundledScores()) {
            services.mastery.save(score.id, markLearned(null, 0));
        }
        expect(await screen.findByText("Today")).toBeTruthy();
        const learn = await screen.findByRole("link", { name: /Learn “First Steps Song”/ });
        expect(learn.getAttribute("href")).toContain("/play/g1-easy");
    });

    it("continues a saved assignment ahead of the built-in starter", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([]);
        const { services } = mount();
        services.assignments.save(
            makeAssignment({ name: "My set", items: [{ id: "piece-a" }, { id: "piece-b" }] }),
        );
        services.mastery.save("piece-a", markLearned(null, 0));
        const cont = await screen.findByRole("link", { name: /Continue “My set”/ });
        expect(cont.getAttribute("href")).toContain("/play/piece-b");
        expect(cont.textContent).toContain("step 2 of 2");
    });
});
