// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "../../core/prefs";
import { memoryStore } from "../adapters/memoryStore";
import { createPrefsStore } from "./prefsStore";

// The store is exercised entirely over the in-memory fake: no browser, no jsdom,
// no globals — the payoff of taking the backing store as an injected port.
describe("prefsStore", () => {
    it("loads defaults from an empty store and round-trips a save", () => {
        const store = createPrefsStore(memoryStore());
        expect(store.load()).toEqual(DEFAULT_PREFS);
        store.save({ ...store.load(), sound: false, volume: 40 });
        expect(store.load().sound).toBe(false);
        expect(store.load().volume).toBe(40);
    });

    it("clamps the volume on the way in", () => {
        const store = createPrefsStore(memoryStore());
        store.save({ ...store.load(), volume: 250 });
        expect(store.load().volume).toBe(100);
    });

    it("returns the same snapshot object until the stored value changes", () => {
        const store = createPrefsStore(memoryStore());
        const first = store.load();
        expect(store.load()).toBe(first);
        store.save({ ...first, treadmill: true });
        const second = store.load();
        expect(second).not.toBe(first);
        expect(store.load()).toBe(second);
    });

    it("notifies subscribers on save and stops after unsubscribe", () => {
        const store = createPrefsStore(memoryStore());
        const onChange = vi.fn();
        const unsubscribe = store.subscribe(onChange);
        store.save({ ...store.load(), sound: false });
        expect(onChange).toHaveBeenCalledTimes(1);
        unsubscribe();
        store.save({ ...store.load(), sound: true });
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("sees a change written to the backing store by someone else", () => {
        const kv = memoryStore();
        const store = createPrefsStore(kv);
        expect(store.load().treadmill).toBe(false);
        kv.set("plinky:prefs", JSON.stringify({ treadmill: true }));
        expect(store.load().treadmill).toBe(true);
    });
});
