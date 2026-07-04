// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// What to practise today, in priority order, so the home page can tell a player
// exactly what to do the moment they open the app. Pure: the component gathers the
// signals from local state and hands them here.

export type Task =
    | { key: "review"; count: number; to: string }
    | { key: "daily"; to: string; done: boolean }
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
        // One due piece goes straight to it; several start a guided review session
        // that walks through them all, so the rest aren't hidden behind one song.
        const to = dueIds.length === 1 ? `/play/${dueIds[0]}` : "/review";
        tasks.push({ key: "review", count: dueIds.length, to });
    }
    // Not yet done, the daily is an action and sits up in the priority list.
    if (!dailyDoneToday) {
        tasks.push({ key: "daily", to: "/daily", done: false });
    }
    if (suggestion) {
        tasks.push({ key: "learn", title: suggestion.title, to: `/play/${suggestion.id}` });
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
