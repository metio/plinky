// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type TodayInput, todayTasks } from "./today";

const piece = (id: string) => ({ id, kind: "piece" as const });

const input = (overrides: Partial<TodayInput> = {}): TodayInput => ({
    due: [],
    dailyDoneToday: false,
    assignment: null,
    suggestion: null,
    ...overrides,
});

describe("todayTasks", () => {
    it("prioritises reviews, then the daily, then something to learn", () => {
        const tasks = todayTasks(
            input({
                due: [piece("a"), piece("b")],
                dailyDoneToday: false,
                suggestion: { id: "song-x", title: "A New Piece", kind: "piece" },
            }),
        );
        expect(tasks.map((t) => t.key)).toEqual(["review", "daily", "learn"]);
        // Several due items start the guided review session, not just the first.
        expect(tasks[0]).toEqual({ key: "review", count: 2, to: "/review" });
        expect(tasks[2]).toEqual({ key: "learn", title: "A New Piece", to: "/play/song-x" });
    });

    it("links a single due piece straight to it", () => {
        const tasks = todayTasks(input({ due: [piece("only")], dailyDoneToday: true }));
        expect(tasks[0]).toEqual({ key: "review", count: 1, to: "/play/only" });
    });

    it("opens a single due ear item on its drill, not a score", () => {
        const tasks = todayTasks(
            input({ due: [{ id: "ear-intervals-0", kind: "ear" }], dailyDoneToday: true }),
        );
        expect(tasks[0]).toEqual({
            key: "review",
            count: 1,
            to: "/ear?exercise=intervals&level=0",
        });
    });

    it("suggests an ear item with a link to its drill", () => {
        const tasks = todayTasks(
            input({
                dailyDoneToday: true,
                suggestion: { id: "ear-perfect-pitch", title: "Perfect pitch", kind: "ear" },
            }),
        );
        expect(tasks[0]).toEqual({
            key: "learn",
            title: "Perfect pitch",
            to: "/ear?exercise=perfect-pitch&level=0",
        });
    });

    it("keeps the daily once done, ticked off after the to-dos", () => {
        const tasks = todayTasks(
            input({ dailyDoneToday: true, suggestion: { id: "s", title: "T", kind: "piece" } }),
        );
        expect(tasks.map((t) => t.key)).toEqual(["learn", "daily"]);
        // It's still a link to today's result, marked done.
        expect(tasks[1]).toEqual({ key: "daily", to: "/daily", done: true });
    });

    it("puts the open assignment's current step in the learn slot, over the suggestion", () => {
        const tasks = todayTasks(
            input({
                assignment: { name: "First steps", step: 2, total: 8, scoreId: "step-two" },
                suggestion: { id: "song-x", title: "A New Piece", kind: "piece" },
            }),
        );
        expect(tasks.map((t) => t.key)).toEqual(["daily", "assignment"]);
        // Straight into the step's play page, not the assignments page.
        expect(tasks[1]).toEqual({
            key: "assignment",
            name: "First steps",
            step: 2,
            total: 8,
            to: "/play/step-two",
        });
    });

    it("returns to the generated suggestion once every assignment is finished", () => {
        const tasks = todayTasks(
            input({
                assignment: null,
                suggestion: { id: "song-x", title: "A New Piece", kind: "piece" },
            }),
        );
        expect(tasks.map((t) => t.key)).toEqual(["daily", "learn"]);
    });

    it("falls back to browsing, with the done daily still reachable", () => {
        const tasks = todayTasks(input({ dailyDoneToday: true }));
        expect(tasks).toEqual([
            { key: "browse", to: "/library" },
            { key: "daily", to: "/daily", done: true },
        ]);
    });
});
