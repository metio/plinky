// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { loadLifetime, PROGRESS_COLUMNS, progressGrid, recordRun, type Skill } from "./lifetime";

afterEach(() => {
    localStorage.clear();
});

const PERFECT: Skill = { accuracy: 100, timing: 100, flow: 100 };
const POOR: Skill = { accuracy: 0, timing: 0, flow: 0 };

// Local-time noon on the nth so the day bucket is 2026-06-0n in any runner zone.
function day(n: number): Date {
    return new Date(2026, 5, n, 12, 0);
}

describe("recordRun", () => {
    it("seeds the average from the first run", () => {
        const lifetime = recordRun(PERFECT, day(1));
        expect(lifetime.days).toHaveLength(1);
        expect(lifetime.days[0]?.skill).toEqual(PERFECT);
    });

    it("smooths later runs rather than jumping to them", () => {
        recordRun(PERFECT, day(1));
        const lifetime = recordRun(POOR, day(2));
        // A single poor run pulls a perfect average only part of the way down.
        const skill = lifetime.days.at(-1)?.skill;
        expect(skill?.accuracy).toBeGreaterThan(0);
        expect(skill?.accuracy).toBeLessThan(100);
        expect(skill?.accuracy).toBe(75); // 0.25*0 + 0.75*100
    });

    it("keeps one snapshot per day, updating within the day", () => {
        recordRun(PERFECT, day(1));
        recordRun(POOR, day(1));
        const lifetime = loadLifetime();
        expect(lifetime.days).toHaveLength(1);
        expect(lifetime.days[0]?.skill.accuracy).toBe(75);
    });

    it("appends a new snapshot on a new day", () => {
        recordRun(PERFECT, day(1));
        recordRun(PERFECT, day(2));
        expect(loadLifetime().days).toHaveLength(2);
    });

    it("trims history to a bounded window", () => {
        for (let n = 1; n <= 20; n++) {
            recordRun(PERFECT, day(n));
        }
        // Stored history is capped well below the number of days played.
        expect(loadLifetime().days.length).toBeLessThanOrEqual(14);
    });
});

describe("loadLifetime", () => {
    it("orders by date when a run arrives out of order (clock set back)", () => {
        recordRun(PERFECT, day(5));
        recordRun(PERFECT, day(3));
        const days = loadLifetime().days;
        expect(days.map((entry) => entry.date)).toEqual(["2026-06-03", "2026-06-05"]);
        // The earlier day seeds fresh rather than blending against the later one.
        expect(days[0]?.skill).toEqual(PERFECT);
    });

    it("keeps one snapshot per day even when a day repeats out of order", () => {
        recordRun(PERFECT, day(5));
        recordRun(PERFECT, day(3));
        recordRun(POOR, day(3));
        const days = loadLifetime().days;
        expect(days.filter((entry) => entry.date === "2026-06-03")).toHaveLength(1);
    });

    it("drops days with a malformed skill rather than crashing recordRun", () => {
        localStorage.setItem(
            "plinky:lifetime",
            JSON.stringify({ days: [{ date: "2026-06-01", skill: null }] }),
        );
        expect(loadLifetime().days).toEqual([]);
        // A later run must seed cleanly instead of blending against the bad day.
        const lifetime = recordRun(PERFECT, day(2));
        expect(lifetime.days).toHaveLength(1);
        expect(lifetime.days[0]?.skill).toEqual(PERFECT);
    });
});

describe("progressGrid", () => {
    it("is null before any run", () => {
        expect(progressGrid(loadLifetime())).toBeNull();
    });

    it("renders three rows over the recent days", () => {
        for (let n = 1; n <= 8; n++) {
            recordRun(PERFECT, day(n));
        }
        const grid = progressGrid(loadLifetime());
        expect(grid).not.toBeNull();
        expect(grid).toHaveLength(3);
        // No more columns than the display window.
        expect(grid?.[0]?.length).toBe(PROGRESS_COLUMNS);
        expect(grid?.[0]?.[0]).toBe("strong"); // a perfect streak shows green
    });

    it("uses one column per day when fewer than the window", () => {
        recordRun(PERFECT, day(1));
        recordRun(PERFECT, day(2));
        expect(progressGrid(loadLifetime())?.[0]).toHaveLength(2);
    });
});
