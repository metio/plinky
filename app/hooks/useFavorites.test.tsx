// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createFavoritesStore } from "../stores/favoritesStore";
import { ServicesProvider } from "../contexts/services";
import { useFavorites } from "./useFavorites";

// The DI payoff end to end: the hook renders against a provider carrying a
// memory store — no jsdom globals stubbed, no module mocked.
describe("useFavorites", () => {
    it("follows the injected store through toggles", () => {
        const kv = memoryStore();
        const favorites = createFavoritesStore(kv);
        const wrapper = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={{ store: kv, favorites }}>{children}</ServicesProvider>
        );
        const { result } = renderHook(() => useFavorites(), { wrapper });
        expect(result.current.size).toBe(0);

        act(() => {
            favorites.toggle("twinkle");
        });
        expect(result.current.has("twinkle")).toBe(true);

        act(() => {
            favorites.toggle("twinkle");
        });
        expect(result.current.has("twinkle")).toBe(false);
    });

    it("reads favorites persisted before mount", () => {
        const kv = memoryStore({ "plinky:favorites": JSON.stringify(["a", "b"]) });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <ServicesProvider services={{ store: kv }}>{children}</ServicesProvider>
        );
        const { result } = renderHook(() => useFavorites(), { wrapper });
        expect([...result.current].sort()).toEqual(["a", "b"]);
    });
});
