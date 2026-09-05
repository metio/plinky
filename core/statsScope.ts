// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { todayKey } from "./daily";
import { daysBetween, daysInRange, shiftDay, weekdayIndex } from "./dateKey";
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
            return weekStart(today);
    }
}

function weekStart(today: string): string {
    // Counted on the date key itself, so a clock change inside the week cannot land the
    // shift a day out: the week starts weekdayIndex days before today, Monday first.
    return shiftDay(today, -weekdayIndex(today));
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
    return daysBetween(start, todayKey(now)) + 1;
}

export type DaySeries = { date: string; notes: number }[];

// One entry per day of this week, Monday to today, with the notes played on each — the
// bars under the week tile. Drawn from the same window scopeSummary("week") counts, so
// the chart and the figures above it never describe two different sets of days; a
// rolling seven days would disagree with the calendar week on every day but Sunday.
export function weekSeries(history: History, now: Date): DaySeries {
    const start = scopeStart("week", now) ?? todayKey(now);
    return daysInRange(start, todayKey(now)).map((date) => ({
        date,
        notes: history[date] ?? 0,
    }));
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

// How this month compares with the one before it, for the line that opens the Stats page.
//
// Days rather than notes on purpose. Notes counts what a piece happens to contain — a
// study of semiquavers outscores a slow Chopin nocturne by a factor of ten — so a player
// who practised harder can be told they did less. Days answers "did I sit down", which is
// the thing a player actually controls and the only honest measure of a month.
//
// It says what happened and stops. It does not say "better", because more days is not
// better playing, and it never mentions a run of consecutive days: nothing here counts a
// streak, and a month spent away is not a thing to be reported back to somebody.
export type MonthOverMonth = {
    days: number;
    // Days more than last month, when there was a last month with practice in it and this
    // month has more. Null otherwise — including when this month is quieter, which is not
    // a figure worth putting in front of anybody.
    more: number | null;
    // Nothing recorded before this month: a first month rather than a comparison.
    first: boolean;
};

export function monthOverMonth(history: History, now: Date): MonthOverMonth {
    const days = scopeSummary(history, "month", now).daysPracticed;
    const previous = new Date(now);
    previous.setDate(0);
    const before = scopeSummary(history, "month", previous).daysPracticed;
    // "First month" means nothing recorded before this one at all, not merely a quiet
    // previous month — somebody returning after a break is not starting over.
    const everBefore = Object.entries(history).some(
        ([date, notes]) => notes > 0 && date < (scopeStart("month", now) ?? ""),
    );
    return { days, more: before > 0 && days > before ? days - before : null, first: !everBefore };
}
