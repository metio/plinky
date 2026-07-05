// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createOnboardingStore } from "./onboardingStore";

describe("onboardingStore", () => {
    it("starts with nothing marked and remembers a markable step", () => {
        const store = createOnboardingStore(memoryStore());
        expect(store.marked().size).toBe(0);
        store.markDiscovered("earTried");
        expect(store.marked().has("earTried")).toBe(true);
    });

    it("ignores derived steps, whose completion is read from real state", () => {
        const store = createOnboardingStore(memoryStore());
        store.markDiscovered("played");
        store.markDiscovered("dailyDone");
        expect(store.marked().size).toBe(0);
    });

    it("marks each step once — a repeat neither writes nor notifies", () => {
        const kv = memoryStore();
        const set = vi.spyOn(kv, "set");
        const store = createOnboardingStore(kv);
        store.markDiscovered("composed");
        const onChange = vi.fn();
        store.subscribe(onChange);
        store.markDiscovered("composed");
        expect(set).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("drops non-markable junk from a tampered store", () => {
        const store = createOnboardingStore(
            memoryStore({ "plinky:discovered": JSON.stringify(["earTried", "played", "bogus"]) }),
        );
        expect([...store.marked()]).toEqual(["earTried"]);
    });
});
