// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { createActivitySignal } from "../lib/activity";
import type { GradeCatalogItem, GradedMastery } from "../lib/gradeProgress";
import type { Mastery } from "../../core/mastery";
import { useStatsData } from "./useStatsData";

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
    masteryMock.mockReset();
    catalogueMock.mockReset();
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

const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider
        services={createServices({ store: memoryStore(), activity: createActivitySignal() })}
    >
        {children}
    </ServicesProvider>
);

const earned = (data: ReturnType<typeof useStatsData>, id: string) =>
    data?.achievements.find((achievement) => achievement.id === id)?.earned;

const gradeOne = (count: number, mastery: (i: number) => Mastery = () => fresh) =>
    Array.from({ length: count }, (_, i) => ({
        id: `g1-${i}`,
        title: `g1-${i}`,
        grade: 1,
        cost: 1,
        kind: "piece" as const,
        mastery: mastery(i),
    }));

describe("useStatsData badges", () => {
    // One device across visits to the page: the badge a visit showed is still there on the
    // next, whatever happened to the pieces behind it in between.
    function visits() {
        const services = createServices({ store: memoryStore(), activity: createActivitySignal() });
        const own = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={services}>{children}</ServicesProvider>
        );
        return async () => {
            const { result, unmount } = renderHook(() => useStatsData(), { wrapper: own });
            await waitFor(() => expect(result.current).not.toBeNull());
            const data = result.current;
            unmount();
            return data;
        };
    }

    it("keeps a star badge after one of the pieces that earned it is shelved", async () => {
        const visit = visits();
        catalogueMock.mockResolvedValue([]);
        masteryMock.mockResolvedValue(gradeOne(5));
        expect(earned(await visit(), "star-bronze")).toBe(true);

        masteryMock.mockResolvedValue(
            gradeOne(5, (i) => (i === 0 ? { ...fresh, backlog: true } : fresh)),
        );
        expect(earned(await visit(), "star-bronze")).toBe(true);
    });

    it("keeps a star badge after one of the pieces that earned it is un-marked", async () => {
        const visit = visits();
        catalogueMock.mockResolvedValue([]);
        masteryMock.mockResolvedValue(gradeOne(5));
        expect(earned(await visit(), "star-bronze")).toBe(true);

        masteryMock.mockResolvedValue(
            gradeOne(5, (i) => (i === 0 ? { ...fresh, learned: false, reviewAt: 0 } : fresh)),
        );
        expect(earned(await visit(), "star-bronze")).toBe(true);
    });

    it("still raises the badge when more pieces are mastered later", async () => {
        const visit = visits();
        catalogueMock.mockResolvedValue([]);
        masteryMock.mockResolvedValue(gradeOne(5));
        expect(earned(await visit(), "star-silver")).toBe(false);

        masteryMock.mockResolvedValue(gradeOne(12));
        const later = await visit();
        expect(earned(later, "star-silver")).toBe(true);
        expect(earned(later, "star-gold")).toBe(false);
    });
});

describe("useStatsData", () => {
    it("is null until the mastery loads, then derives the standing in one shot", async () => {
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

        const { result } = renderHook(() => useStatsData(), { wrapper });
        expect(result.current).toBeNull();

        await waitFor(() => expect(result.current).not.toBeNull());
        const data = result.current;
        expect(data?.level).toBe(1);
        expect(data?.workingGrade).toBe(2);
        // The gentlest next-grade piece leads the suggestions.
        expect(data?.upNext[0]?.id).toBe("g2-easy");
        expect(data?.reviews).toEqual([]);
    });

    it("resolves due reviews to linkable titles", async () => {
        masteryMock.mockResolvedValue([
            {
                id: "stale",
                title: "Für Elise",
                grade: 1,
                cost: 1,
                kind: "piece",
                mastery: { ...fresh, reviewAt: Date.now() - 86_400_000 },
            },
        ]);
        catalogueMock.mockResolvedValue([]);

        const { result } = renderHook(() => useStatsData(), { wrapper });
        await waitFor(() => expect(result.current).not.toBeNull());
        expect(result.current?.reviews).toEqual([
            { id: "stale", title: "Für Elise", kind: "piece" },
        ]);
    });
});
