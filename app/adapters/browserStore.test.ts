// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it } from "vitest";
import { withDeniedStorage } from "../lib/deniedStorage";
import { browserStore } from "./browserStore";

describe("browserStore", () => {
    afterEach(() => {
        localStorage.clear();
    });

    it("round-trips through localStorage", () => {
        browserStore.set("plinky:x", "1");
        expect(browserStore.get("plinky:x")).toBe("1");
        expect(browserStore.keys()).toContain("plinky:x");
        browserStore.remove("plinky:x");
        expect(browserStore.get("plinky:x")).toBeNull();
    });

    // The one denied-storage guard: when merely touching localStorage throws
    // (Firefox with site-data off, a sandboxed iframe), every operation degrades
    // instead of crashing the caller — the invariant every storage helper used to
    // re-implement, now held in exactly one place.
    it("degrades to empty results when storage is blocked, never throwing", () => {
        withDeniedStorage(() => {
            expect(() => browserStore.set("plinky:x", "1")).not.toThrow();
            expect(browserStore.get("plinky:x")).toBeNull();
            expect(browserStore.keys()).toEqual([]);
            expect(() => browserStore.remove("plinky:x")).not.toThrow();
        });
    });
});
