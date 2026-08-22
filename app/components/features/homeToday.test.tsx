// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeAssignment } from "../../../core/assignment";
import { markLearned } from "../../../core/mastery";
import type { GradeCatalogItem, GradedMastery } from "../../lib/gradeProgress";
import { loadBundledScores } from "../../lib/catalog";
import { m } from "../../paraglide/messages.js";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
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

// The warm-up carries a playable keyboard, which listens through the MIDI provider —
// over a fake here, never the real Web MIDI.
const mount = (overrides = {}) =>
    renderWithServices(
        <MemoryRouter>
            <MidiProvider>
                <HomeToday />
            </MidiProvider>
        </MemoryRouter>,
        // biome-ignore lint/suspicious/noExplicitAny: a partial exercise source is all the panel reads
        { exercises: exercises as any, midi: fakeMidi(), ...overrides },
    );

describe("HomeToday", () => {
    it("hands a brand-new player the starter assignment's first step", async () => {
        masteryMock.mockResolvedValue([]); // brand-new player, Grade 0
        catalogueMock.mockResolvedValue([
            { id: "g1-easy", title: "First Steps Song", grade: 1, cost: 1, kind: "piece" },
            ...loadBundledScores().map((score) => ({
                id: score.id,
                title: score.title,
                grade: 1,
                cost: 1,
                kind: "piece" as const,
            })),
        ]);
        mount();
        expect(await screen.findByText(m.today_moment_work())).toBeTruthy();
        // The guided path outranks the generated suggestion, and its link goes
        // straight into the current step's play page — named by the piece it opens,
        // because a player who has pressed nothing yet is not continuing anything.
        const first = loadBundledScores()[0]!;
        const cont = await screen.findByRole("link", { name: new RegExp(first.title) });
        expect(cont.getAttribute("href")).toContain(`/play/${first.id}`);
        expect(cont.textContent).toContain(m.today_assignment_set({ name: "First steps" }));
        // Nobody handed this player a checklist, so nothing counts them against one.
        expect(cont.textContent).not.toContain("1");
        expect(screen.queryByRole("link", { name: /Learn “/ })).toBeNull();
        expect(screen.getByRole("link", { name: /daily challenge/i })).toBeTruthy();
    });

    it("says where a piece stands, so a played one is not silently offered again", async () => {
        // A step advances when the piece counts as learned, which means a run reaching
        // the grade set in Settings. Playing it through at less than that leaves the
        // step where it was — correct, and baffling until the row says so.
        masteryMock.mockResolvedValue([
            {
                id: loadBundledScores()[0]!.id,
                title: loadBundledScores()[0]!.title,
                grade: 1,
                cost: 1,
                kind: "piece" as const,
                mastery: {
                    bestScore: 70,
                    learned: false,
                    backlog: false,
                    intervalDays: 0,
                    reviewAt: 0,
                    updatedAt: 0,
                    deadline: "",
                },
            },
        ]);
        catalogueMock.mockResolvedValue(
            loadBundledScores().map((score) => ({
                id: score.id,
                title: score.title,
                grade: 1,
                cost: 1,
                kind: "piece" as const,
            })),
        );
        mount();
        // 70 reads as a C, and the default bar is an A.
        expect(
            await screen.findByText(m.today_best_so_far({ best: "C", target: "A" }), {
                exact: false,
            }),
        ).toBeTruthy();
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
        expect(await screen.findByText(m.today_moment_work())).toBeTruthy();
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
        // CTA lands on the playable one — never on the play page's dead end. The
        // catalogue mock knows no titles here, so the row names the set instead of
        // inventing one, and says which step of it this is.
        // Wait for the settled reading: the panel first offers the dead step and
        // corrects itself once the known-piece set resolves.
        await screen.findByText(m.today_assignment_step({ name: "My set", step: 2, total: 2 }));
        const cont = screen.getByRole("link", { name: /My set/ });
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
        await screen.findByText(m.today_assignment_set({ name: "My set" }));
        const cont = screen.getByRole("link", { name: /My set/ });
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
        await screen.findByText(m.today_assignment_step({ name: "My set", step: 2, total: 2 }));
        const cont = screen.getByRole("link", { name: /My set/ });
        expect(cont.getAttribute("href")).toContain(`/play/${second}`);
    });
});
