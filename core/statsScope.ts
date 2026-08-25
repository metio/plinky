// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { todayKey } from "./daily";
import type { History } from "./history";

// Which window of time the You page's figures are about.
//
// The page used to carry six windows at once — a lifetime total near the top, a seven-day
// chart under it, the practice report's own week/month/quarter/year control, a balance
// computed over the whole log, a calendar-month recap card near the foot, and an unlabelled
// lifetime fingerprint at the very end. A reader had no way to tell that these were the
// same few numbers seen through different windows, because nothing on the page said so.
//
// One dial says it. Every figure that depends on a period reads this and nothing else.
export const SCOPES = ["week", "month", "year", "all"] as const;
export type Scope = (typeof SCOPES)[number];

// Every scope is a CALENDAR period running up to today, never a rolling count of days.
//
// This is the one decision that had to be settled rather than left to each caller, and it
// was the page's real bug: the practice report's "month" meant the last thirty days, while
// the recap card's meant August. Both were on screen, both were labelled month, and they
// disagreed — by up to a factor of two on the first of the month, when "this month" holds
// one day and "the last thirty days" holds all of July.
//
// Calendar wins because it is the one a player already has: somebody who practised every
// day in August and looks on the 2nd of September wants to be told about August, and
// "your last thirty days" is a sentence nobody says. It also gives the tile a name — the
// month, the year — where a rolling window can only be described.
export function scopeStart(scope: Scope, now: Date): string | null {
    const today = todayKey(now);
    switch (scope) {
        case "all":
            // No start: everything ever recorded.
            return null;
        case "year":
            return `${today.slice(0, 4)}-01-01`;
        case "month":
            return `${today.slice(0, 7)}-01`;
        case "week":
            // The week starts on Monday, which is what a calendar in most of the world
            // shows and what "this week" means to somebody looking at one. Sunday reads as
            // the end of a week here, not the start of the next.
            return weekStart(today, now);
    }
}

function weekStart(today: string, now: Date): string {
    // getDay is 0 for Sunday, so Monday-first is (day + 6) % 7 days back.
    const back = (now.getDay() + 6) % 7;
    const start = new Date(now);
    start.setDate(start.getDate() - back);
    const iso = todayKey(start);
    // A clock change inside the week can make the shift land a day out; the start can
    // never be after today, so clamp rather than trust the arithmetic.
    return iso > today ? today : iso;
}

// Whether a date key falls inside the scope. Keys are YYYY-MM-DD, so they compare as
// strings — which is why the format is worth keeping.
export function inScope(date: string, scope: Scope, now: Date): boolean {
    const start = scopeStart(scope, now);
    return date <= todayKey(now) && (start === null || date >= start);
}

// How many days the scope covers, counting today. What the practice report wants: it
// reasons in days back from today and has no opinion about calendars, so the calendar
// decision is made here once and handed over as a number.
//
// Null for all time, where there is no count to give — a caller shows everything.
export function scopeDays(scope: Scope, now: Date): number | null {
    const start = scopeStart(scope, now);
    if (start === null) {
        return null;
    }
    const from = new Date(`${start}T00:00:00`);
    const to = new Date(`${todayKey(now)}T00:00:00`);
    return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export type ScopeSummary = {
    totalNotes: number;
    daysPracticed: number;
    // The day the most notes were played in this scope, or null when nothing was.
    bestDay: { date: string; notes: number } | null;
};

// The three figures every scope reports, over one window. The same fold the monthly recap
// used to do for August alone, now able to answer for any of the four.
export function scopeSummary(history: History, scope: Scope, now: Date): ScopeSummary {
    let totalNotes = 0;
    let daysPracticed = 0;
    let bestDay: { date: string; notes: number } | null = null;
    for (const [date, notes] of Object.entries(history)) {
        if (notes <= 0 || !inScope(date, scope, now)) {
            continue;
        }
        totalNotes += notes;
        daysPracticed += 1;
        if (!bestDay || notes > bestDay.notes) {
            bestDay = { date, notes };
        }
    }
    return { totalNotes, daysPracticed, bestDay };
}
