// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it, vi } from "vitest";
import { PROGRESS_COLUMNS, progressGrid, type Skill } from "../../core/lifetime";
import { memoryStore } from "../adapters/memoryStore";
import { createLifetimeStore } from "./lifetimeStore";

const PERFECT: Skill = { accuracy: 100, timing: 100, flow: 100 };
const POOR: Skill = { accuracy: 0, timing: 0, flow: 0 };

// Local-time noon on the nth so the day bucket is 2026-06-0n in any runner zone.
function day(n: number): Date {
    return new Date(2026, 5, n, 12, 0);
}

describe("lifetimeStore.recordRun", () => {
    it("seeds the average from the first run", () => {
        const store = createLifetimeStore(memoryStore());
        const lifetime = store.recordRun(PERFECT, day(1));
        expect(lifetime.days).toHaveLength(1);
        expect(lifetime.days[0]?.skill).toEqual(PERFECT);
    });

    it("smooths later runs rather than jumping to them", () => {
        const store = createLifetimeStore(memoryStore());
        store.recordRun(PERFECT, day(1));
        const lifetime = store.recordRun(POOR, day(2));
        // A single poor run pulls a perfect average only part of the way down.
        expect(lifetime.days.at(-1)?.skill.accuracy).toBe(75); // 0.25*0 + 0.75*100
    });

    it("keeps one snapshot per day, updating within the day", () => {
        const store = createLifetimeStore(memoryStore());
        store.recordRun(PERFECT, day(1));
        store.recordRun(POOR, day(1));
        expect(store.load().days).toHaveLength(1);
        expect(store.load().days[0]?.skill.accuracy).toBe(75);
    });

    it("appends a new snapshot on a new day and trims to a bounded window", () => {
        const store = createLifetimeStore(memoryStore());
        for (let n = 1; n <= 20; n++) {
            store.recordRun(PERFECT, day(n));
        }
        expect(store.load().days.length).toBeLessThanOrEqual(14);
    });

    it("orders by date when a run arrives out of order (clock set back)", () => {
        const store = createLifetimeStore(memoryStore());
        store.recordRun(PERFECT, day(5));
        store.recordRun(PERFECT, day(3));
        const days = store.load().days;
        expect(days.map((entry) => entry.date)).toEqual(["2026-06-03", "2026-06-05"]);
        // The earlier day seeds fresh rather than blending against the later one.
        expect(days[0]?.skill).toEqual(PERFECT);
    });

    it("persists through the injected store and notifies subscribers", () => {
        const kv = memoryStore();
        const store = createLifetimeStore(kv);
        const onChange = vi.fn();
        store.subscribe(onChange);
        store.recordRun(PERFECT, day(1));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(createLifetimeStore(kv).load().days).toHaveLength(1);
    });

    it("still returns the folded lifetime when the write is refused", () => {
        const store = createLifetimeStore({ ...memoryStore(), set: () => false });
        expect(store.recordRun(PERFECT, day(1)).days).toHaveLength(1);
        expect(store.load().days).toHaveLength(0);
    });
});

describe("lifetimeStore.load", () => {
    it("drops days with a malformed skill rather than crashing the fold", () => {
        const kv = memoryStore({
            "plinky:lifetime": JSON.stringify({ days: [{ date: "2026-06-01", skill: null }] }),
        });
        const store = createLifetimeStore(kv);
        expect(store.load().days).toEqual([]);
        // A later run must seed cleanly instead of blending against the bad day.
        const lifetime = store.recordRun(PERFECT, day(2));
        expect(lifetime.days).toHaveLength(1);
        expect(lifetime.days[0]?.skill).toEqual(PERFECT);
    });

    it("reads corrupt storage as an empty fingerprint", () => {
        expect(createLifetimeStore(memoryStore({ "plinky:lifetime": "{oops" })).load()).toEqual({
            days: [],
        });
    });
});

describe("progressGrid over the stored fingerprint", () => {
    it("is null before any run", () => {
        expect(progressGrid(createLifetimeStore(memoryStore()).load())).toBeNull();
    });

    it("renders three rows over the recent days, capped at the display window", () => {
        const store = createLifetimeStore(memoryStore());
        for (let n = 1; n <= 8; n++) {
            store.recordRun(PERFECT, day(n));
        }
        const grid = progressGrid(store.load());
        expect(grid).toHaveLength(3);
        expect(grid?.[0]?.length).toBe(PROGRESS_COLUMNS);
        expect(grid?.[0]?.[0]).toBe("best"); // a perfect streak shows green
    });

    it("uses one column per day when fewer than the window", () => {
        const store = createLifetimeStore(memoryStore());
        store.recordRun(PERFECT, day(1));
        store.recordRun(PERFECT, day(2));
        expect(progressGrid(store.load())?.[0]).toHaveLength(2);
    });
});
