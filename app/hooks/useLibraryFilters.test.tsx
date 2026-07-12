// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { LibraryItem } from "../../core/library";
import { memoryStore } from "../adapters/memoryStore";
import { createServices, ServicesProvider } from "../contexts/services";
import { useLibraryFilters } from "./useLibraryFilters";

const item = (parts: Partial<LibraryItem>): LibraryItem => ({
    id: "id",
    title: "Title",
    composer: "Composer",
    grade: 1,
    removable: false,
    kind: "song",
    ...parts,
});

const world = () => {
    const services = createServices({ store: memoryStore() });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={services}>{children}</ServicesProvider>
    );
    return { services, wrapper };
};

describe("useLibraryFilters", () => {
    it("narrows the matches as the query changes", () => {
        const items = [item({ id: "a", title: "Ode to Joy" }), item({ id: "b", title: "Air" })];
        const { wrapper } = world();
        const { result } = renderHook(() => useLibraryFilters(items, {}), { wrapper });
        expect(result.current.matches).toHaveLength(2);
        act(() => result.current.setQuery("ode"));
        expect(result.current.matches.map((entry) => entry.id)).toEqual(["a"]);
    });

    it("toggles grades independently and clears them all at once", () => {
        const items = [item({ id: "g1", grade: 1 }), item({ id: "g2", grade: 2 })];
        const { wrapper } = world();
        const { result } = renderHook(() => useLibraryFilters(items, {}), { wrapper });
        act(() => result.current.toggleGrade(1));
        expect(result.current.matches.map((entry) => entry.id)).toEqual(["g1"]);
        act(() => result.current.toggleGrade(2));
        expect(result.current.matches).toHaveLength(2);
        act(() => result.current.toggleGrade(1));
        expect(result.current.matches.map((entry) => entry.id)).toEqual(["g2"]);
        act(() => result.current.clearGrades());
        expect(result.current.matches).toHaveLength(2);
    });

    it("follows the starred set when favoritesOnly is on", () => {
        const items = [item({ id: "starred" }), item({ id: "plain" })];
        const { services, wrapper } = world();
        const { result } = renderHook(() => useLibraryFilters(items, {}), { wrapper });
        act(() => result.current.toggleFavoritesOnly());
        expect(result.current.matches).toHaveLength(0);
        // Starring through the store re-renders the hook — the set is subscribed,
        // not mirrored.
        act(() => {
            services.favorites.toggle("starred");
        });
        expect(result.current.matches.map((entry) => entry.id)).toEqual(["starred"]);
    });

    it("pages by 60 and resets to the first page when a filter changes", () => {
        const items = Array.from({ length: 130 }, (_, i) =>
            item({ id: `piece-${i}`, title: `Piece ${i}` }),
        );
        const { wrapper } = world();
        const { result } = renderHook(() => useLibraryFilters(items, {}), { wrapper });
        expect(result.current.visible).toBe(60);
        act(() => result.current.showMore());
        expect(result.current.visible).toBe(120);
        // A new filter starts from the top of its result set.
        act(() => result.current.setQuery("piece"));
        expect(result.current.visible).toBe(60);
    });

    it("filters to due pieces from the mastery map", () => {
        const items = [item({ id: "due" }), item({ id: "untracked" })];
        const mastery = {
            due: {
                bestScore: 90,
                learned: true,
                backlog: false,
                intervalDays: 5,
                reviewAt: 1,
                updatedAt: 0,
            },
        };
        const { wrapper } = world();
        const { result } = renderHook(() => useLibraryFilters(items, mastery), { wrapper });
        act(() => result.current.toggleDueOnly());
        expect(result.current.matches.map((entry) => entry.id)).toEqual(["due"]);
    });
});
