// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import type { Mastery } from "../../core/mastery";
import { memoryStore } from "../adapters/memoryStore";
import { createMasteryStore } from "./masteryStore";

// Exercised entirely over the in-memory fake: no browser, no jsdom, no globals.
const NOW = 1_000_000_000_000;

const mastery = (overrides: Partial<Mastery> = {}): Mastery => ({
    bestScore: 88,
    learned: true,
    backlog: false,
    intervalDays: 3,
    reviewAt: NOW,
    updatedAt: NOW,
    ...overrides,
});

describe("masteryStore", () => {
    it("reads null for an unplayed score and the value after a save", () => {
        const store = createMasteryStore(memoryStore());
        expect(store.load("song-1")).toBeNull();
        store.save("song-1", mastery());
        expect(store.load("song-1")).toEqual(mastery());
    });

    it("returns a stable snapshot reference until the entry changes", () => {
        const store = createMasteryStore(memoryStore());
        store.save("song-1", mastery());
        const first = store.load("song-1");
        expect(store.load("song-1")).toBe(first);
        store.save("song-1", mastery({ bestScore: 95 }));
        expect(store.load("song-1")).not.toBe(first);
    });

    it("notifies subscribers on save and stops after unsubscribe", () => {
        const store = createMasteryStore(memoryStore());
        const onChange = vi.fn();
        const unsubscribe = store.subscribe(onChange);
        store.save("song-1", mastery());
        expect(onChange).toHaveBeenCalledTimes(1);
        unsubscribe();
        store.save("song-1", mastery({ bestScore: 99 }));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("lists every stored entry and skips a corrupt one", () => {
        const kv = memoryStore({
            "plinky:mastery:bad": "not json",
            "plinky:unrelated": "1",
        });
        const store = createMasteryStore(kv);
        store.save("song-1", mastery());
        store.save("song-2", mastery({ bestScore: 70 }));
        const all = store.loadAll();
        expect(all.map((entry) => entry.id).sort()).toEqual(["song-1", "song-2"]);
    });

    it("repairs a legacy entry missing fields through the normalizer", () => {
        const kv = memoryStore({
            "plinky:mastery:old": JSON.stringify({ bestScore: 90, learned: true }),
        });
        const store = createMasteryStore(kv);
        const loaded = store.load("old");
        expect(loaded?.intervalDays).toBe(0);
        expect(loaded?.reviewAt).toBe(0);
    });

    it("keeps subscribers quiet about a refused write", () => {
        const kv = memoryStore();
        const store = createMasteryStore({ ...kv, set: () => false });
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.save("song-1", mastery())).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
        expect(store.load("song-1")).toBeNull();
    });
});
