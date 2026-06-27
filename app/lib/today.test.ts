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
        expect(tasks[0]).toEqual({ key: "review", count: 2, to: "/play/a" });
        expect(tasks[2]).toEqual({ key: "learn", title: "A New Piece", to: "/play/song-x" });
    });

    it("drops the daily once it's done", () => {
        const tasks = todayTasks(
            input({ dailyDoneToday: true, suggestion: { id: "s", title: "T" } }),
        );
        expect(tasks.map((t) => t.key)).toEqual(["learn"]);
    });

    it("falls back to browsing when nothing is queued", () => {
        const tasks = todayTasks(input({ dailyDoneToday: true }));
        expect(tasks).toEqual([{ key: "browse", to: "/library" }]);
    });
});
