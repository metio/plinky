// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { todayKey } from "./daily";
import { type Grid, toGrid } from "./shareCard";

// A slow-moving skill fingerprint: the player's Accuracy, Timing and Flow tracked
// across their practice days, each smoothed with an exponential moving average so
// it climbs gradually rather than swinging with one good or bad run. One snapshot
// is kept per day (the latest within the day wins), and the recent days become the
// columns of the shareable progress grid.

// Each dimension on the same 0..100 scale as the run grade.
export type Skill = { accuracy: number; timing: number; flow: number };

export type Lifetime = { days: { date: string; skill: Skill }[] };

const KEY = "plinky:lifetime";
// The weight a single run carries against the accumulated average. Low enough that
// progress looks earned, not instant.
const ALPHA = 0.25;
// Days retained; the grid shows a window of the most recent.
const MAX_DAYS = 14;
export const PROGRESS_COLUMNS = 6;

const EMPTY: Lifetime = { days: [] };

function ema(previous: number, value: number): number {
    return ALPHA * value + (1 - ALPHA) * previous;
}

function blend(previous: Skill, run: Skill): Skill {
    return {
        accuracy: ema(previous.accuracy, run.accuracy),
        timing: ema(previous.timing, run.timing),
        flow: ema(previous.flow, run.flow),
    };
}

export function loadLifetime(): Lifetime {
    if (typeof localStorage === "undefined") {
        return EMPTY;
    }
    try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? (JSON.parse(raw) as Lifetime) : null;
        return parsed && Array.isArray(parsed.days) ? parsed : EMPTY;
    } catch {
        return EMPTY;
    }
}

// Folds a finished run into the fingerprint: the first run seeds the average, each
// later one nudges it. Several runs in a day collapse into that day's snapshot, so
// the columns track distinct sessions rather than raw attempt count.
export function recordRun(run: Skill, now: Date = new Date()): Lifetime {
    const lifetime = loadLifetime();
    const date = todayKey(now);
    const last = lifetime.days.at(-1);
    const skill = last ? blend(last.skill, run) : run;
    const days =
        last?.date === date
            ? [...lifetime.days.slice(0, -1), { date, skill }]
            : [...lifetime.days, { date, skill }];
    const next: Lifetime = { days: days.slice(-MAX_DAYS) };
    if (typeof localStorage !== "undefined") {
        try {
            localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
            // The fingerprint is best-effort; a failed write is not surfaced.
        }
    }
    return next;
}

// The recent days as a share grid, or null before any run has been recorded.
export function progressGrid(lifetime: Lifetime): Grid | null {
    const recent = lifetime.days.slice(-PROGRESS_COLUMNS);
    if (recent.length === 0) {
        return null;
    }
    return toGrid(
        recent.map((day) => ({
            accuracy: day.skill.accuracy / 100,
            timing: day.skill.timing / 100,
            flow: day.skill.flow / 100,
        })),
    );
}
