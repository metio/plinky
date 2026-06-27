// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// What to practise today, in priority order, so the home page can tell a player
// exactly what to do the moment they open the app. Pure: the component gathers the
// signals from local state and hands them here.

export type Task =
    | { key: "review"; count: number; to: string }
    | { key: "daily"; to: string }
    | { key: "learn"; title: string; to: string }
    | { key: "browse"; to: string };

export type TodayInput = {
    // Pieces due for a refresh, most-overdue first (from the grade model).
    dueIds: string[];
    // Whether today's daily challenge is already done.
    dailyDoneToday: boolean;
    // The gentlest unmastered piece of the grade being worked on, if any.
    suggestion: { id: string; title: string } | null;
};

// Refresh what's fading first (keeps grades sharp), then the daily, then something
// new to learn. If there's genuinely nothing queued, fall back to browsing — the list
// is never empty, so the player always has a next step.
export function todayTasks({ dueIds, dailyDoneToday, suggestion }: TodayInput): Task[] {
    const tasks: Task[] = [];
    if (dueIds.length > 0) {
        tasks.push({ key: "review", count: dueIds.length, to: `/play/${dueIds[0]}` });
    }
    if (!dailyDoneToday) {
        tasks.push({ key: "daily", to: "/daily" });
    }
    if (suggestion) {
        tasks.push({ key: "learn", title: suggestion.title, to: `/play/${suggestion.id}` });
    }
    if (tasks.length === 0) {
        tasks.push({ key: "browse", to: "/library" });
    }
    return tasks;
}
