// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createOnboardingStore } from "./onboardingStore";

describe("onboardingStore", () => {
    it("starts with nothing marked and remembers a markable step", () => {
        const store = createOnboardingStore(memoryStore());
        expect(store.marked().size).toBe(0);
        store.markDiscovered("keyboardMet");
        expect(store.marked().has("keyboardMet")).toBe(true);
    });

    it("ignores anything that is not a step it keeps", () => {
        // The store took eleven ids when a checklist showed them; one is read now, and a
        // stale id from an older device must not come back as a step.
        const store = createOnboardingStore(memoryStore());
        store.markDiscovered("played" as never);
        expect(store.marked().size).toBe(0);
    });

    it("marks each step once — a repeat neither writes nor notifies", () => {
        const kv = memoryStore();
        const set = vi.spyOn(kv, "set");
        const store = createOnboardingStore(kv);
        store.markDiscovered("keyboardMet");
        const onChange = vi.fn();
        store.subscribe(onChange);
        store.markDiscovered("keyboardMet");
        expect(set).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("drops non-markable junk from a tampered store", () => {
        const store = createOnboardingStore(
            memoryStore({
                "plinky:discovered": JSON.stringify(["keyboardMet", "played", "bogus"]),
            }),
        );
        expect([...store.marked()]).toEqual(["keyboardMet"]);
    });
});
