// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it, vi } from "vitest";
import { withDeniedStorage } from "../testing/deniedStorage";
import { browserStore, createBrowserStore, storageHealth } from "./browserStore";

afterEach(() => {
    localStorage.clear();
});

describe("browserStore", () => {
    it("round-trips through localStorage", () => {
        browserStore.set("plinky:x", "1");
        expect(browserStore.get("plinky:x")).toBe("1");
        expect(browserStore.keys()).toContain("plinky:x");
        browserStore.remove("plinky:x");
        expect(browserStore.get("plinky:x")).toBeNull();
    });

    it("exposes one shared instance behind the module's store and health", () => {
        expect(withDeniedStorage(() => browserStore.set("plinky:x", "1"))).toBe(false);
        expect(storageHealth.failed()).toBe(true);
    });
});

describe("createBrowserStore", () => {
    it("starts healthy and hands out an independent latch per instance", () => {
        const first = createBrowserStore();
        const second = createBrowserStore();

        expect(first.health.failed()).toBe(false);
        expect(second.health.failed()).toBe(false);

        withDeniedStorage(() => first.store.set("plinky:x", "1"));

        expect(first.health.failed()).toBe(true);
        expect(second.health.failed()).toBe(false);
    });

    it("notifies each subscriber once on the first refused write, then latches", () => {
        const { store, health } = createBrowserStore();
        const kept = vi.fn();
        const dropped = vi.fn();
        health.subscribe(kept);
        health.subscribe(dropped)();

        expect(withDeniedStorage(() => store.set("plinky:x", "1"))).toBe(false);
        expect(health.failed()).toBe(true);
        expect(kept).toHaveBeenCalledTimes(1);
        expect(dropped).not.toHaveBeenCalled();

        expect(withDeniedStorage(() => store.set("plinky:x", "1"))).toBe(false);
        expect(kept).toHaveBeenCalledTimes(1);
    });

    it("latches on a refused remove, not only a refused set", () => {
        const { store, health } = createBrowserStore();
        const listener = vi.fn();
        health.subscribe(listener);

        withDeniedStorage(() => {
            store.remove("plinky:x");
        });

        expect(health.failed()).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("leaves the latch alone when writes land", () => {
        const { store, health } = createBrowserStore();
        expect(store.set("plinky:x", "1")).toBe(true);
        store.remove("plinky:x");
        expect(health.failed()).toBe(false);
    });

    it("keeps the store fully working after a past failure — a signal, not a circuit breaker", () => {
        const { store, health } = createBrowserStore();
        withDeniedStorage(() => store.set("plinky:x", "1"));

        expect(health.failed()).toBe(true);
        expect(store.set("plinky:x", "2")).toBe(true);
        expect(store.get("plinky:x")).toBe("2");
    });
});

// The one denied-storage guard: when merely touching localStorage throws
// (Firefox with site-data off, a sandboxed iframe), every operation degrades
// instead of crashing the caller — the single guard the whole app relies on.
describe("browserStore under denied storage", () => {
    it("degrades to empty results when storage is blocked, never throwing", () => {
        const { store } = createBrowserStore();
        withDeniedStorage(() => {
            expect(() => store.set("plinky:x", "1")).not.toThrow();
            expect(store.get("plinky:x")).toBeNull();
            expect(store.keys()).toEqual([]);
            expect(() => store.remove("plinky:x")).not.toThrow();
        });
    });
});
