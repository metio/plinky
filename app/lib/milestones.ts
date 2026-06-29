// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { letterMin } from "./mastery";

// Earned moments that surface a shareable card on the run summary. Each fires at most
// once: a grade-up is gated by the highest grade ever reached, the first flawless run
// by a one-time flag. First-S-on-a-song needs no record of its own — the song's stored
// best score already guards it (once it sits at S it can never cross into S again).
export type Milestone =
    | { kind: "first-s"; songTitle: string }
    | { kind: "grade-up"; grade: number; skill: number }
    | { kind: "flawless"; songTitle: string };

// The highest grade we've already celebrated, so reaching it again is silent.
const REACHED_GRADE_KEY = "plinky:reached-grade";
// Whether the one-time flawless-run card has fired.
const FLAWLESS_KEY = "plinky:flawless-done";

export function reachedGrade(): number {
    try {
        const raw = Number(localStorage.getItem(REACHED_GRADE_KEY));
        return Number.isFinite(raw) ? raw : 0;
    } catch {
        // No storage (SSR) or a browser that blocks it — nothing celebrated yet.
        return 0;
    }
}

export function recordReachedGrade(grade: number): void {
    try {
        localStorage.setItem(REACHED_GRADE_KEY, String(Math.max(reachedGrade(), grade)));
    } catch {
        // Best-effort — a milestone showing twice is harmless.
    }
}

export function flawlessDone(): boolean {
    try {
        return localStorage.getItem(FLAWLESS_KEY) === "1";
    } catch {
        // No storage (SSR) or a browser that blocks it — treat as not yet fired.
        return false;
    }
}

export function recordFlawless(): void {
    try {
        localStorage.setItem(FLAWLESS_KEY, "1");
    } catch {
        // Best-effort.
    }
}

// A run scores S the moment its aggregate clears the S cutoff (95); it is the song's
// first S only if its previous best sat below that line.
export function isFirstS(score: number, previousBest: number): boolean {
    return score >= letterMin("S") && previousBest < letterMin("S");
}

// A flawless run is a perfect aggregate — all three of accuracy, timing and flow at
// 100 — which only a clean, in-time, unbroken performance reaches.
export function isFlawless(score: number): boolean {
    return score >= 100;
}
