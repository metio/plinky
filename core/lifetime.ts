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

// The weight a single run carries against the accumulated average. Low enough that
// progress looks earned, not instant.
const ALPHA = 0.25;
// Days retained; the grid shows a window of the most recent.
const MAX_DAYS = 14;
export const PROGRESS_COLUMNS = 6;

const EMPTY: Lifetime = { days: [] };

function isSkill(value: unknown): value is Skill {
    if (!value || typeof value !== "object") {
        return false;
    }
    const skill = value as Record<string, unknown>;
    return (
        Number.isFinite(skill.accuracy) &&
        Number.isFinite(skill.timing) &&
        Number.isFinite(skill.flow)
    );
}

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

// Coerce a parsed stored value into a well-formed Lifetime: a malformed skill
// would otherwise crash the EMA blend in foldRun or yield a NaN progress grid.
export function normalizeLifetime(parsed: unknown): Lifetime {
    const value = parsed as Lifetime | null;
    if (!value || !Array.isArray(value.days)) {
        return EMPTY;
    }
    const days = value.days.filter(
        (day) => day && typeof day.date === "string" && isSkill(day.skill),
    );
    return { days };
}

// Folds a finished run into the fingerprint: the first run seeds the average, each
// later one nudges it. Several runs in a day collapse into that day's snapshot, so
// the columns track distinct sessions rather than raw attempt count.
export function foldRun(lifetime: Lifetime, run: Skill, now: Date): Lifetime {
    const date = todayKey(now);
    // Order by date rather than trusting append order: a clock set back or travel
    // across timezones can produce a run whose day is earlier than the last
    // stored one, which must update or insert by date, not duplicate the tail.
    const sorted = [...lifetime.days].sort((a, b) => a.date.localeCompare(b.date));
    // Blend against the most recent snapshot on or before this day — the same day
    // when updating within it, otherwise the previous day it builds on.
    const prior = sorted.filter((day) => day.date <= date).at(-1);
    const skill = prior ? blend(prior.skill, run) : run;
    const days = [...sorted.filter((day) => day.date !== date), { date, skill }].sort((a, b) =>
        a.date.localeCompare(b.date),
    );
    return { days: days.slice(-MAX_DAYS) };
}

// The recent days as a share grid, or null before any run has been recorded.
export function progressGrid(lifetime: Lifetime): Grid | null {
    const recent = lifetime.days.slice(-PROGRESS_COLUMNS);
    if (recent.length === 0) {
        return null;
    }
    // The fingerprint is a lifetime view of the practice grade, so it keeps that trio —
    // Accuracy, Timing, Flow — rather than the share card's performance dimensions.
    return toGrid(
        recent.map((day) => ({
            accuracy: day.skill.accuracy / 100,
            timing: day.skill.timing / 100,
            flow: day.skill.flow / 100,
        })),
        ["accuracy", "timing", "flow"],
    );
}
