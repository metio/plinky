// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type TodayInput, todayTasks } from "./today";

const input = (overrides: Partial<TodayInput> = {}): TodayInput => ({
    dueIds: [],
    dailyDoneToday: false,
    suggestion: null,
    ...overrides,
});

describe("todayTasks", () => {
    it("prioritises reviews, then the daily, then something to learn", () => {
        const tasks = todayTasks(
            input({
                dueIds: ["a", "b"],
                dailyDoneToday: false,
                suggestion: { id: "song-x", title: "A New Piece" },
            }),
        );
        expect(tasks.map((t) => t.key)).toEqual(["review", "daily", "learn"]);
        // Several due pieces start the guided review session, not just the first.
        expect(tasks[0]).toEqual({ key: "review", count: 2, to: "/review" });
        expect(tasks[2]).toEqual({ key: "learn", title: "A New Piece", to: "/play/song-x" });
    });

    it("links a single due piece straight to it", () => {
        const tasks = todayTasks(input({ dueIds: ["only"], dailyDoneToday: true }));
        expect(tasks[0]).toEqual({ key: "review", count: 1, to: "/play/only" });
    });

    it("keeps the daily once done, ticked off after the to-dos", () => {
        const tasks = todayTasks(
            input({ dailyDoneToday: true, suggestion: { id: "s", title: "T" } }),
        );
        expect(tasks.map((t) => t.key)).toEqual(["learn", "daily"]);
        // It's still a link to today's result, marked done.
        expect(tasks[1]).toEqual({ key: "daily", to: "/daily", done: true });
    });

    it("falls back to browsing, with the done daily still reachable", () => {
        const tasks = todayTasks(input({ dailyDoneToday: true }));
        expect(tasks).toEqual([
            { key: "browse", to: "/library" },
            { key: "daily", to: "/daily", done: true },
        ]);
    });
});
