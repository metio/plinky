// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which part of the day it is, so the front page can open by naming it — "Tuesday
// morning" rather than "Today". A page that knows when you came reads as somebody
// noticing you arrived, and it costs nothing to know.
//
// Pure: the hour arrives as a number. The clock, the weekday name and the language it
// is spelled in all belong to the caller.

export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

// The boundaries are the ordinary ones a person would use rather than clock quarters:
// morning starts when the day does, evening at the end of the working one, and the
// small hours are night rather than a very early morning — somebody at the piano at
// two is not having a morning.
export function partOfDay(hour: number): PartOfDay {
    const clock = Math.floor(hour);
    if (clock >= 5 && clock < 12) {
        return "morning";
    }
    if (clock >= 12 && clock < 18) {
        return "afternoon";
    }
    if (clock >= 18 && clock < 22) {
        return "evening";
    }
    return "night";
}

// The boundaries themselves, in hours, so the wait below and the reading above cannot
// drift apart: both are this list.
const BOUNDARIES = [5, 12, 18, 22];

// How long until the greeting would say something different, from a given moment.
//
// The front page names the part of the day it was opened in, and left open across one of
// these hours it went on saying the old one — a page still wishing you a good afternoon at
// seven in the evening. The alternative to waiting for the boundary is polling, which means
// a timer doing nothing all day to catch four moments.
//
// Never zero: exactly on a boundary the answer is a whole day, not "right now", and a wait
// of nothing would spin.
export function msUntilPartOfDayChanges(now: Date): number {
    const hour = now.getHours();
    const next = BOUNDARIES.find((boundary) => boundary > hour) ?? BOUNDARIES[0]! + 24;
    const at = new Date(now);
    at.setHours(next, 0, 0, 0);
    // A boundary that has already gone today is tomorrow's.
    if (at.getTime() <= now.getTime()) {
        at.setDate(at.getDate() + 1);
    }
    return at.getTime() - now.getTime();
}
