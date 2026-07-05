// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it, vi } from "vitest";
import { withDeniedStorage } from "../lib/deniedStorage";
import { browserStore, storageHealth } from "./browserStore";

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
});

// The latch flips once and stays flipped for this module's lifetime, so these
// tests run before anything else provokes a write failure, and each step below
// builds on the state the previous one left behind.
describe("storageHealth", () => {
    it("starts healthy, notifies each subscriber once on the first refused write, and latches", () => {
        expect(storageHealth.failed()).toBe(false);

        const kept = vi.fn();
        const dropped = vi.fn();
        storageHealth.subscribe(kept);
        storageHealth.subscribe(dropped)();

        expect(withDeniedStorage(() => browserStore.set("plinky:x", "1"))).toBe(false);
        expect(storageHealth.failed()).toBe(true);
        expect(kept).toHaveBeenCalledTimes(1);
        expect(dropped).not.toHaveBeenCalled();

        // Latched: a further failure changes nothing and stays silent.
        expect(withDeniedStorage(() => browserStore.set("plinky:x", "1"))).toBe(false);
        expect(kept).toHaveBeenCalledTimes(1);
    });

    it("keeps the adapter fully working after a past failure — a signal, not a circuit breaker", () => {
        expect(storageHealth.failed()).toBe(true);
        expect(browserStore.set("plinky:x", "2")).toBe(true);
        expect(browserStore.get("plinky:x")).toBe("2");
    });
});

// The one denied-storage guard: when merely touching localStorage throws
// (Firefox with site-data off, a sandboxed iframe), every operation degrades
// instead of crashing the caller — the single guard the whole app relies on.
describe("browserStore under denied storage", () => {
    it("degrades to empty results when storage is blocked, never throwing", () => {
        withDeniedStorage(() => {
            expect(() => browserStore.set("plinky:x", "1")).not.toThrow();
            expect(browserStore.get("plinky:x")).toBeNull();
            expect(browserStore.keys()).toEqual([]);
            expect(() => browserStore.remove("plinky:x")).not.toThrow();
        });
    });
});
