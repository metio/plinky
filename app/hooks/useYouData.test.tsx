// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { createActivitySignal } from "../lib/activity";
import type { GradeCatalogItem, GradedMastery } from "../lib/gradeProgress";
import type { Mastery } from "../../core/mastery";
import { useYouData } from "./useYouData";

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
};

const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider
        services={createServices({ store: memoryStore(), activity: createActivitySignal() })}
    >
        {children}
    </ServicesProvider>
);

describe("useYouData", () => {
    it("is null until the mastery loads, then derives the standing in one shot", async () => {
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

        const { result } = renderHook(() => useYouData(), { wrapper });
        expect(result.current).toBeNull();

        await waitFor(() => expect(result.current).not.toBeNull());
        const data = result.current;
        expect(data?.level).toBe(1);
        expect(data?.workingGrade).toBe(2);
        // The gentlest next-grade piece leads the suggestions.
        expect(data?.upNext[0]?.id).toBe("g2-easy");
        expect(data?.poolSizes.get(2)).toBe(2);
        expect(data?.reviews).toEqual([]);
    });

    it("resolves due reviews to linkable titles", async () => {
        masteryMock.mockResolvedValue([
            {
                id: "stale",
                title: "Für Elise",
                grade: 1,
                cost: 1,
                mastery: { ...fresh, reviewAt: Date.now() - 86_400_000 },
            },
        ]);
        catalogueMock.mockResolvedValue([]);

        const { result } = renderHook(() => useYouData(), { wrapper });
        await waitFor(() => expect(result.current).not.toBeNull());
        expect(result.current?.reviews).toEqual([{ id: "stale", title: "Für Elise" }]);
    });
});
