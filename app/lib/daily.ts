// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { generatePhrase } from "./generator";
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

// About how long the day's phrase should take to play. Long enough that accuracy,
// timing and flow each have real signal — a handful of notes grades almost nothing.
const DAILY_SECONDS = 45;
// The phrase is one quarter note per beat, so the tempo doubles as the
// notes-per-minute rate. This band keeps a beginner reading and reaching at a
// human pace — slower drags, faster turns sight-reading into a scramble.
const DAILY_MIN_BPM = 80;
const DAILY_MAX_BPM = 120;
const BEATS_PER_BAR = 4;

// The day's challenge: a phrase to play and the tempo to play it at. Both are
// generated from the date alone — never the device's catalogue — so everyone gets
// the same challenge regardless of which scores they happen to have, and the pool
// never runs dry. The bar count is sized so the phrase lasts about DAILY_SECONDS
// at the chosen tempo, keeping the daily effort steady as the tempo drifts from
// day to day.
export type DailyChallenge = { tempo: number; xml: string };

export function dailyChallenge(dateKey: string, number: number): DailyChallenge {
    const rng = seededRandom(hashString(`daily:${dateKey}`));
    const tempo = DAILY_MIN_BPM + Math.round(rng() * (DAILY_MAX_BPM - DAILY_MIN_BPM));
    const beats = Math.round((DAILY_SECONDS * tempo) / 60);
    const bars = Math.max(1, Math.round(beats / BEATS_PER_BAR));
    const xml = generatePhrase(
        { bars, beatsPerBar: BEATS_PER_BAR, twoHands: false, title: `Plinky #${number}` },
        rng,
    );
    return { tempo, xml };
}
