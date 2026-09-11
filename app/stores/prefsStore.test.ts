// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { namingFor } from "../../core/noteNaming";
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

    // A French page names the keys do re mi until the player picks; nudging the volume is
    // not a pick, so the same device on an English page names them in letters.
    it("keeps the language's note names a default through an unrelated save", () => {
        const kv = memoryStore();
        const device = createPrefsStore(kv);
        device.save({ ...device.load(), volume: 40 });
        const prefs = createPrefsStore(kv).load();
        expect(prefs.volume).toBe(40);
        expect(namingFor(prefs.noteLabels, "en", prefs.noteLetters).system).toBe("letters");
        expect(namingFor(prefs.noteLabels, "fr", prefs.noteLetters).system).toBe("solfege");
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

    it("reports a refused write and keeps subscribers quiet", () => {
        const kv = memoryStore();
        const refusing = { ...kv, set: () => false };
        const store = createPrefsStore(refusing);
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.save({ ...store.load(), sound: false })).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
        expect(store.load().sound).toBe(true);
    });

    it("sees a change written to the backing store by someone else", () => {
        const kv = memoryStore();
        const store = createPrefsStore(kv);
        expect(store.load().treadmill).toBe(false);
        kv.set("plinky:prefs", JSON.stringify({ treadmill: true }));
        expect(store.load().treadmill).toBe(true);
    });
});
