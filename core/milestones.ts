// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Grade } from "./grade";
import { letterMin } from "./mastery";

// Earned moments that surface a shareable card on the run summary. Each fires at most
// once: a grade-up is gated by the highest grade ever reached, the first flawless run
// by a one-time flag. First-S-on-a-song needs no record of its own — the song's stored
// best score already guards it (once it sits at S it can never cross into S again).
export type Milestone =
    | { kind: "first-s"; songTitle: string }
    | { kind: "grade-up"; grade: number; skill: number }
    | { kind: "flawless"; songTitle: string };

// A run scores S the moment its aggregate clears the S cutoff (95); it is the song's
// first S only if its previous best sat below that line.
export function isFirstS(score: number, previousBest: number): boolean {
    return score >= letterMin("S") && previousBest < letterMin("S");
}

// A flawless run has all three of accuracy, timing and flow at 100 — a clean,
// in-time, unbroken performance. The rounded aggregate score is too loose: a
// 100/100/99 run rounds up to a score of 100 while a note was still out of time,
// so the milestone reads the three dimensions the letter is built from directly.
export function isFlawless(grade: Pick<Grade, "accuracy" | "timing" | "flow">): boolean {
    return grade.accuracy === 100 && grade.timing === 100 && grade.flow === 100;
}
