// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { memoryStore } from "../adapters/memoryStore";
import { createHistoryStore } from "./historyStore";

// Local-time noon so the derived day key is 2026-06-23 in any runner zone.
const NOW = new Date(2026, 5, 23, 12, 0);

describe("historyStore", () => {
    it("records notes onto today's tally and notifies subscribers", () => {
        const store = createHistoryStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        store.record(10, NOW);
        store.record(5, NOW);
        expect(store.load()["2026-06-23"]).toBe(15);
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("records nothing — and stays silent — for a non-positive count", () => {
        const store = createHistoryStore(memoryStore());
        const onChange = vi.fn();
        store.subscribe(onChange);
        store.record(0, NOW);
        expect(store.load()).toEqual({});
        expect(onChange).not.toHaveBeenCalled();
    });

    it("recovers from a stored array by folding onto a fresh history", () => {
        const store = createHistoryStore(memoryStore({ "plinky:history": "[1,2,3]" }));
        expect(store.load()).toEqual({});
        store.record(10, NOW);
        expect(store.load()["2026-06-23"]).toBe(10);
    });
});
