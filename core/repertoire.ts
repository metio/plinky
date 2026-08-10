// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { daysBetween } from "./dateKey";
import { type Mastery, isLapsed } from "./mastery";

// Where a piece sits in the arc from first read to kept-up repertoire. Every
// practice journal names these stages, and a player working toward a recital
// thinks in them — "polishing" is a different kind of session from "learning".
//
// Derived from the spaced-repetition state rather than stored: the review interval
// already measures how securely a piece is known, growing on each passing review
// and resetting on a failing one. A separately stored stage would be a second
// answer to the same question, free to drift from the first, and would need a
// migration and a control to set it. This needs neither.
export type Stage = "learning" | "consolidating" | "polishing" | "maintenance";

export const STAGES: Stage[] = ["learning", "consolidating", "polishing", "maintenance"];

// The interval boundaries between stages, in days. A piece reviewed weekly is still
// being consolidated; one holding a month is being polished; past that it is kept
// rather than learned.
const CONSOLIDATING_UNTIL = 7;
const POLISHING_UNTIL = 30;

export function stageOf(mastery: Mastery | null): Stage {
    if (!mastery?.learned) {
        return "learning";
    }
    if (mastery.intervalDays < CONSOLIDATING_UNTIL) {
        return "consolidating";
    }
    if (mastery.intervalDays < POLISHING_UNTIL) {
        return "polishing";
    }
    return "maintenance";
}

// A date the player is working toward — an exam, a recital, a lesson. This is the
// one thing about a piece the app genuinely cannot derive, which is why it is stored
// while the stage is not.
export type Deadline = {
    // The local calendar date, or "" for a piece with no date set.
    date: string;
    daysLeft: number;
    // Past the date and not yet in maintenance. Named for the state, not as a
    // verdict: the panel says what is coming, and never that the player is late.
    passed: boolean;
};

export function deadlineFor(date: string, today: string): Deadline | null {
    if (date === "") {
        return null;
    }
    const daysLeft = daysBetween(today, date);
    return { date, daysLeft, passed: daysLeft < 0 };
}

// A piece plus the two things the repertoire view sorts on.
export type RepertoireItem<T> = {
    item: T;
    mastery: Mastery;
    stage: Stage;
    deadline: Deadline | null;
    // A learned piece left well past its review date. Surfaced so a player working
    // toward a date can see which of their pieces has quietly slipped, which is the
    // question a programme raises and the grade ladder does not answer.
    slipping: boolean;
};

// Everything with a deadline, soonest first, then everything else by stage. A piece
// with no date never outranks one that has: the panel exists to answer "what is
// coming up", and an undated piece is not coming up.
export function orderRepertoire<T>(items: RepertoireItem<T>[]): RepertoireItem<T>[] {
    return [...items].sort((left, right) => {
        const leftDays = left.deadline?.daysLeft;
        const rightDays = right.deadline?.daysLeft;
        if (leftDays !== undefined && rightDays !== undefined) {
            return leftDays - rightDays;
        }
        if (leftDays !== undefined) {
            return -1;
        }
        if (rightDays !== undefined) {
            return 1;
        }
        return STAGES.indexOf(left.stage) - STAGES.indexOf(right.stage);
    });
}

export function buildRepertoire<T extends { id: string }>(
    items: T[],
    masteryOf: (id: string) => Mastery | null,
    today: string,
    now: number,
): RepertoireItem<T>[] {
    const built: RepertoireItem<T>[] = [];
    for (const item of items) {
        const mastery = masteryOf(item.id);
        if (!mastery) {
            continue;
        }
        const deadline = deadlineFor(mastery.deadline, today);
        // A piece nobody has touched and nobody has dated is not repertoire; it is
        // catalogue. Listing it would bury the handful of pieces being worked on.
        if (!mastery.learned && mastery.bestScore === 0 && !deadline) {
            continue;
        }
        built.push({
            item,
            mastery,
            stage: stageOf(mastery),
            deadline,
            slipping: isLapsed(mastery, now),
        });
    }
    return orderRepertoire(built);
}
