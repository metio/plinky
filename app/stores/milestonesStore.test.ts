// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createMilestonesStore } from "./milestonesStore";

describe("milestonesStore", () => {
    it("starts with no grade celebrated and no flawless run", () => {
        const store = createMilestonesStore(memoryStore());
        expect(store.reachedGrade()).toBe(0);
        expect(store.flawlessDone()).toBe(false);
    });

    it("remembers the highest grade celebrated, never lowering it", () => {
        const store = createMilestonesStore(memoryStore());
        expect(store.recordReachedGrade(3)).toBe(true);
        store.recordReachedGrade(2);
        expect(store.reachedGrade()).toBe(3);
        store.recordReachedGrade(5);
        expect(store.reachedGrade()).toBe(5);
    });

    it("latches the one-time flawless flag", () => {
        const kv = memoryStore();
        const store = createMilestonesStore(kv);
        expect(store.recordFlawless()).toBe(true);
        expect(store.flawlessDone()).toBe(true);
        expect(createMilestonesStore(kv).flawlessDone()).toBe(true);
    });

    it("notifies subscribers for either flag", () => {
        const store = createMilestonesStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        store.recordReachedGrade(2);
        store.recordFlawless();
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("reads corrupt storage as fresh state", () => {
        const store = createMilestonesStore(
            memoryStore({ "plinky:reached-grade": "{bad", "plinky:flawless-done": "nope" }),
        );
        expect(store.reachedGrade()).toBe(0);
        expect(store.flawlessDone()).toBe(false);
    });

    it("starts with no badge marks and raises them without ever lowering", () => {
        const kv = memoryStore();
        const store = createMilestonesStore(kv);
        expect(store.badgeMarks()).toEqual({ star: null, earMastered: false });
        expect(store.recordBadgeMarks({ star: "silver", earMastered: false })).toBe(true);
        store.recordBadgeMarks({ star: "bronze", earMastered: true });
        expect(store.badgeMarks()).toEqual({ star: "silver", earMastered: true });
        store.recordBadgeMarks({ star: null, earMastered: false });
        expect(createMilestonesStore(kv).badgeMarks()).toEqual({
            star: "silver",
            earMastered: true,
        });
    });

    it("writes badge marks only when something is new", () => {
        const store = createMilestonesStore(memoryStore());
        store.recordBadgeMarks({ star: "gold", earMastered: false });
        const onChange = vi.fn();
        store.subscribe(onChange);
        expect(store.recordBadgeMarks({ star: "silver", earMastered: false })).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
        store.recordBadgeMarks({ star: "gold", earMastered: true });
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("reads corrupt badge marks as none", () => {
        const store = createMilestonesStore(memoryStore({ "plinky:badge-marks": "{bad" }));
        expect(store.badgeMarks()).toEqual({ star: null, earMastered: false });
    });

    it("reports refused writes so a celebration may repeat rather than vanish", () => {
        const store = createMilestonesStore({ ...memoryStore(), set: () => false });
        expect(store.recordReachedGrade(4)).toBe(false);
        expect(store.recordFlawless()).toBe(false);
        expect(store.recordBadgeMarks({ star: "bronze", earMastered: false })).toBe(false);
    });
});
