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
