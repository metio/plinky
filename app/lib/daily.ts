// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { hashString, seededRandom } from "./random";

// The viewer's current calendar day as YYYY-MM-DD, in their own time zone. It
// seeds the daily challenge and bounds the practice log, so both a new challenge
// and a streak day roll over at local midnight — the same rule Wordle uses. Two
// players in different zones can therefore be on different days at the same instant.
export function todayKey(now: Date): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const DAY_MS = 86_400_000;
// Day one of the daily challenge; the running number counts up from here so every
// player refers to the same "Plinky #N" on a given date.
export const DAILY_EPOCH = "2026-06-25";

export function dailyNumber(dateKey: string, epoch: string = DAILY_EPOCH): number {
    const days = Math.floor(
        (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${epoch}T00:00:00Z`)) / DAY_MS,
    );
    return days + 1;
}

// The score everyone plays on a given day: a date-seeded pick from the catalogue,
// identical for everyone because the PRNG is fed only the date. Returns null only
// for an empty catalogue. Callers pass ids in a stable order so the pick is stable.
export function dailyScoreId(ids: string[], dateKey: string): string | null {
    if (ids.length === 0) {
        return null;
    }
    const pick = seededRandom(hashString(`score:${dateKey}`))();
    return ids[Math.floor(pick * ids.length)] ?? null;
}
