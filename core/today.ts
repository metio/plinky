// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// What to practise today, in priority order, so the home page can tell a player
// exactly what to do the moment they open the app. Pure: the component gathers the
// signals from local state and hands them here.

import { type ItemKind, practiceHref } from "./practisable";

export type Task =
    | { key: "review"; count: number; to: string }
    | { key: "daily"; to: string; done: boolean }
    | { key: "assignment"; name: string; step: number; total: number; to: string }
    | { key: "learn"; title: string; to: string }
    | { key: "browse"; to: string };

// A due or suggested item, carrying the kind that decides where practising it goes.
export type TodayItem = { id: string; kind: ItemKind };

export type TodayInput = {
    // Items due for a refresh, most-overdue first (from the grade model).
    due: TodayItem[];
    // Whether today's daily challenge is already done.
    dailyDoneToday: boolean;
    // The first assignment with an unfinished step; its current step is the
    // player's next piece on that path.
    assignment: { name: string; step: number; total: number; scoreId: string } | null;
    // The gentlest unmastered item of the grade being worked on, if any.
    suggestion: { id: string; title: string; kind: ItemKind } | null;
};

// Refresh what's fading first (keeps grades sharp), then the daily, then something
// new to learn — the open assignment's current step when one exists (a deliberately
// chosen path beats a generated pick), the grade suggestion otherwise. If there's
// genuinely nothing queued, fall back to browsing — the list is never empty, so the
// player always has a next step.
export function todayTasks({ due, dailyDoneToday, assignment, suggestion }: TodayInput): Task[] {
    const tasks: Task[] = [];
    if (due.length > 0) {
        // One due item goes straight to it, on the surface its kind decides; several
        // start the guided review session that walks through them all, so the rest
        // aren't hidden behind one.
        const only = due.length === 1 ? due[0] : undefined;
        const to = only ? practiceHref(only) : "/review";
        tasks.push({ key: "review", count: due.length, to });
    }
    // Not yet done, the daily is an action and sits up in the priority list.
    if (!dailyDoneToday) {
        tasks.push({ key: "daily", to: "/daily", done: false });
    }
    if (assignment) {
        tasks.push({
            key: "assignment",
            name: assignment.name,
            step: assignment.step,
            total: assignment.total,
            // Straight into the current step's play page — continuing must never
            // require finding the assignment on its own page first.
            to: `/play/${assignment.scoreId}`,
        });
    } else if (suggestion) {
        tasks.push({ key: "learn", title: suggestion.title, to: practiceHref(suggestion) });
    }
    if (tasks.length === 0) {
        tasks.push({ key: "browse", to: "/library" });
    }
    // Once done, the daily still belongs here — it's the only route to today's result
    // and share — but as a ticked-off footer rather than a to-do, so the page is never
    // stranded behind a vanished link.
    if (dailyDoneToday) {
        tasks.push({ key: "daily", to: "/daily", done: true });
    }
    return tasks;
}
