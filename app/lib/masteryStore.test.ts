// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mastery } from "./mastery";
import { masterySnapshot, subscribeMastery, writeMastery } from "./masteryStore";

afterEach(() => localStorage.clear());

const mastery = (overrides: Partial<Mastery> = {}): Mastery => ({
    bestScore: 0,
    learned: false,
    backlog: false,
    intervalDays: 0,
    reviewAt: 0,
    updatedAt: 0,
    ...overrides,
});

describe("masteryStore", () => {
    it("reads null for an unplayed score and the value after a write", () => {
        const unsubscribe = subscribeMastery(() => {});
        expect(masterySnapshot("store-read")).toBeNull();
        writeMastery("store-read", mastery({ learned: true, bestScore: 90 }));
        expect(masterySnapshot("store-read")?.learned).toBe(true);
        unsubscribe();
    });

    it("notifies subscribers when mastery changes", () => {
        const onChange = vi.fn();
        const unsubscribe = subscribeMastery(onChange);
        writeMastery("store-notify", mastery({ learned: true }));
        expect(onChange).toHaveBeenCalled();
        unsubscribe();
    });

    it("returns a stable snapshot reference between notifications", () => {
        const unsubscribe = subscribeMastery(() => {});
        writeMastery("store-stable", mastery({ bestScore: 50 }));
        // Same reference on repeated reads, so useSyncExternalStore won't loop.
        expect(masterySnapshot("store-stable")).toBe(masterySnapshot("store-stable"));
        unsubscribe();
    });

    it("stops notifying after unsubscribe", () => {
        const onChange = vi.fn();
        subscribeMastery(onChange)();
        writeMastery("store-unsub", mastery({ learned: true }));
        expect(onChange).not.toHaveBeenCalled();
    });
});
