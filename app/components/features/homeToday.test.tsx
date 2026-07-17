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
// An empty song manifest makes the known-piece set ready, so unresolvable step
// ids read as missing; without it the default source's failed fetch keeps the
// set indeterminate.
const songs = { manifest: () => Promise.resolve([]) };

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
            { id: "g1-easy", title: "First Steps Song", grade: 1, cost: 1, kind: "piece" },
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
            { id: "g1-easy", title: "First Steps Song", grade: 1, cost: 1, kind: "piece" },
        ]);
        const { services } = mount();
        for (const score of loadBundledScores()) {
            services.mastery.save(score.id, markLearned(null, 0));
        }
        expect(await screen.findByText("Today")).toBeTruthy();
        const learn = await screen.findByRole("link", { name: /Learn “First Steps Song”/ });
        expect(learn.getAttribute("href")).toContain("/play/g1-easy");
    });

    it("skips a missing current step and continues at the next resolvable one", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([]);
        // biome-ignore lint/suspicious/noExplicitAny: a partial song source is all the panel reads
        const { services } = mount({ songs: songs as any });
        const playable = loadBundledScores()[0]!.id;
        services.assignments.save(
            makeAssignment({ name: "My set", items: [{ id: "gone-id" }, { id: playable }] }),
        );
        // The known-piece set is ready, so the dead first step is skipped and the
        // CTA lands on the playable one — never on the play page's dead end.
        const cont = await screen.findByRole("link", { name: /Continue “My set”.*step 2 of 2/ });
        expect(cont.getAttribute("href")).toContain(`/play/${playable}`);
    });

    it("keeps today's pick while the known-piece set is indeterminate", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([]);
        // A failed song-manifest fetch leaves the set indeterminate — the panel
        // still renders, and no step is treated as missing.
        const failingSongs = { manifest: () => Promise.resolve(null) };
        // biome-ignore lint/suspicious/noExplicitAny: a partial song source is all the panel reads
        const { services } = mount({ songs: failingSongs as any });
        services.assignments.save(makeAssignment({ name: "My set", items: [{ id: "gone-id" }] }));
        const cont = await screen.findByRole("link", { name: /Continue “My set”/ });
        expect(cont.getAttribute("href")).toContain("/play/gone-id");
    });

    it("continues a saved assignment ahead of the built-in starter", async () => {
        masteryMock.mockResolvedValue([]);
        catalogueMock.mockResolvedValue([]);
        const { services } = mount();
        // Real bundled ids: once the known-piece set is ready, only resolvable
        // steps count, so an invented id would read as missing and be skipped.
        const [first, second] = loadBundledScores().map((score) => score.id);
        services.assignments.save(
            makeAssignment({ name: "My set", items: [{ id: first! }, { id: second! }] }),
        );
        services.mastery.save(first!, markLearned(null, 0));
        const cont = await screen.findByRole("link", { name: /Continue “My set”/ });
        expect(cont.getAttribute("href")).toContain(`/play/${second}`);
        expect(cont.textContent).toContain("step 2 of 2");
    });
});
