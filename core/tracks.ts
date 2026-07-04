// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Walking an ordered list of pieces as steps — used to show progress through an
// assignment. Nothing is ever locked: every step is playable, the order is a
// suggestion, and progress is just encouragement.

export type TrackStatus = "done" | "current" | "upcoming";
export type TrackStep = { scoreId: string; status: TrackStatus };

// Mark each step done/current/upcoming. The first not-yet-done step is "current"
// (the suggested next thing); everything else upcoming. No step is ever locked.
export function trackSteps(scoreIds: string[], isDone: (id: string) => boolean): TrackStep[] {
    let currentAssigned = false;
    return scoreIds.map((scoreId) => {
        if (isDone(scoreId)) {
            return { scoreId, status: "done" };
        }
        if (!currentAssigned) {
            currentAssigned = true;
            return { scoreId, status: "current" };
        }
        return { scoreId, status: "upcoming" };
    });
}
