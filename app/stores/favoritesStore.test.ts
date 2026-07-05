// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createFavoritesStore } from "./favoritesStore";

// Exercised entirely over the in-memory fake: no browser, no jsdom, no globals.
describe("favoritesStore", () => {
    it("starts empty", () => {
        const favorites = createFavoritesStore(memoryStore());
        expect(favorites.load().size).toBe(0);
        expect(favorites.has("twinkle")).toBe(false);
    });

    it("toggles a score on and off, persisting through the store", () => {
        const kv = memoryStore();
        const favorites = createFavoritesStore(kv);
        expect(favorites.toggle("twinkle")).toBe(true);
        expect(favorites.has("twinkle")).toBe(true);
        // A second instance over the same backing store reads the same truth.
        expect(createFavoritesStore(kv).has("twinkle")).toBe(true);
        favorites.toggle("twinkle");
        expect(favorites.has("twinkle")).toBe(false);
    });

    it("keeps the snapshot identical until the set changes", () => {
        const favorites = createFavoritesStore(memoryStore());
        const first = favorites.load();
        expect(favorites.load()).toBe(first);
        favorites.toggle("a");
        const second = favorites.load();
        expect(second).not.toBe(first);
        expect(favorites.load()).toBe(second);
    });

    it("notifies subscribers per toggle and stops after unsubscribe", () => {
        const favorites = createFavoritesStore(memoryStore());
        const onChange = vi.fn();
        const unsubscribe = favorites.subscribe(onChange);
        favorites.toggle("a");
        favorites.toggle("a");
        expect(onChange).toHaveBeenCalledTimes(2);
        unsubscribe();
        favorites.toggle("a");
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("reports a refused write and leaves the set unchanged", () => {
        const kv = memoryStore();
        const favorites = createFavoritesStore({ ...kv, set: () => false });
        expect(favorites.toggle("a")).toBe(false);
        expect(favorites.has("a")).toBe(false);
    });

    it("falls back to an empty set for corrupt data", () => {
        const favorites = createFavoritesStore(memoryStore({ "plinky:favorites": "not json" }));
        expect(favorites.load().size).toBe(0);
    });

    it("ignores non-string entries", () => {
        const favorites = createFavoritesStore(
            memoryStore({ "plinky:favorites": JSON.stringify(["ok", 5, null]) }),
        );
        expect([...favorites.load()]).toEqual(["ok"]);
    });
});
