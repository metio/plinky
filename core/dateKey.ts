// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Arithmetic over the "YYYY-MM-DD" local calendar keys the practice tallies use
// (see daily.todayKey). Every helper here goes through UTC midnight rather than
// the local clock: the keys are already local dates, so re-interpreting one as a
// local timestamp would land it on a different day for anyone whose offset makes
// midnight fall on the other side of the boundary, and adding 24 hours across a
// daylight-saving change would skip or repeat a day.

const DAY_MS = 86_400_000;

function atUtcMidnight(dateKey: string): number {
    return Date.parse(`${dateKey}T00:00:00Z`);
}

// The key `delta` days after `dateKey` (negative goes back). A key that isn't a
// date comes back unchanged, so a corrupt stored key cannot turn into "NaN-NaN-NaN"
// and seed a range that never terminates.
export function shiftDay(dateKey: string, delta: number): string {
    const start = atUtcMidnight(dateKey);
    if (!Number.isFinite(start)) {
        return dateKey;
    }
    return new Date(start + delta * DAY_MS).toISOString().slice(0, 10);
}

// Whole days from `from` to `to`, negative when `to` is earlier. Both ends sit at
// UTC midnight, so this is exact rather than a rounded division.
export function daysBetween(from: string, to: string): number {
    const start = atUtcMidnight(from);
    const end = atUtcMidnight(to);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return 0;
    }
    return Math.round((end - start) / DAY_MS);
}

// Every key from `from` to `to` inclusive, oldest first. An inverted or unparsable
// range yields nothing — a report over it is empty rather than unbounded. The cap
// bounds what a stored (or hand-typed) range can ask the caller to allocate.
const MAX_RANGE_DAYS = 3660;

export function daysInRange(from: string, to: string): string[] {
    const span = daysBetween(from, to);
    // daysBetween reports 0 for a bound it cannot parse, which would otherwise yield a
    // one-day range holding that unparsable key.
    if (!isDateKey(from) || !isDateKey(to) || span < 0 || span > MAX_RANGE_DAYS) {
        return [];
    }
    const days: string[] = [];
    for (let offset = 0; offset <= span; offset++) {
        days.push(shiftDay(from, offset));
    }
    return days;
}

// True when `dateKey` is a real "YYYY-MM-DD" calendar date. Parsing alone is too
// lax — "2026-02-31" parses, rolling over into March — so the round-trip through
// the canonical form is what rejects it.
export function isDateKey(dateKey: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return false;
    }
    const parsed = atUtcMidnight(dateKey);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === dateKey;
}
