// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Letter } from "./grade";
import { type AidPrefs, levelAids } from "./readingLevel";

// Sight-reading: playing a piece you have never played before, once, with nothing
// to lean on. Practice is the opposite discipline — repetition until it is learned —
// so a run in this mode is scored the same way but remembered differently: only the
// FIRST read of a piece is kept, because after that reading it is no longer sight
// reading.

// How long the score can be studied before the run starts. A real sight-reading
// test gives you a moment to take in the key, the metre and the shape; these are
// the usual lengths, shortest first.
export const STUDY_SECONDS = [5, 10, 20] as const;
export type StudySeconds = (typeof STUDY_SECONDS)[number];
export const DEFAULT_STUDY_SECONDS: StudySeconds = 10;

// The aids a sight-read run reads without. This is exactly the top rung of the
// skill ladder, so the two can never drift apart: turning the mode on is the same
// as reading as a sight-reader does, for this run only, without disturbing the
// preferences the player has chosen for practice.
export function sightReadAids(): AidPrefs {
    return levelAids("sightReader");
}

// One remembered sight-read. `atTempo` records which discipline it was — the cursor
// waiting for you, or advancing on the beat — because the same number means
// different things under each, and a stored score with no such mark is unreadable.
export type SightReadRecord = {
    score: number;
    letter: Letter;
    atTempo: boolean;
    playedAt: number;
};

// The first read is the one that counts, so a stored record is never replaced. A
// later read of the same piece is a re-read, not a sight-read, and silently
// overwriting would quietly turn a true first-sight number into a practised one.
export function firstRead(
    current: SightReadRecord | null,
    next: SightReadRecord,
): SightReadRecord {
    return current ?? next;
}

// Coerce a parsed (possibly corrupt) stored value into a record, or null when it
// cannot be one. A half-written record would otherwise render as a letter-less
// score or an invalid date.
export function normalizeSightRead(raw: unknown): SightReadRecord | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const value = raw as Record<string, unknown>;
    if (
        !Number.isFinite(value.score) ||
        typeof value.letter !== "string" ||
        !Number.isFinite(value.playedAt)
    ) {
        return null;
    }
    return {
        score: value.score as number,
        letter: value.letter as Letter,
        atTempo: value.atTempo === true,
        playedAt: value.playedAt as number,
    };
}

// Which steps have vanished once the step at `clearedIndex` has been played, given
// each step's bar. A bar disappears only once the run has left it — you keep the bar
// you are playing and lose the ones behind you, which is the whole point: the eyes
// have nowhere to go but forward.
//
// Driven by bar rather than by note so a bar vanishes as a unit; a note-by-note fade
// would erase the beat you are still counting through.
export function vanishedSteps(measures: number[], clearedIndex: number): number[] {
    const current = measures[clearedIndex];
    if (current === undefined) {
        return [];
    }
    const gone: number[] = [];
    for (const [index, measure] of measures.entries()) {
        if (measure < current) {
            gone.push(index);
        }
    }
    return gone;
}

// Whole seconds still to study, counting down and never past either end. The clock
// arrives as elapsed milliseconds so this stays pure: the caller owns the timer.
export function studyRemaining(elapsedMs: number, seconds: number): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
        return seconds;
    }
    return Math.max(0, Math.ceil(seconds - elapsedMs / 1000));
}
