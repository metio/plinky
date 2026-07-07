// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Grade } from "../../core/grade";
import { applyRun, letterMin } from "../../core/mastery";
import { isFirstS, isFlawless, type Milestone } from "../../core/milestones";
import type { OutcomeNote } from "../../core/runOutcome";
import type { Grid } from "../../core/shareCard";
import type { AppServices } from "../contexts/services";
import { currentGrade, loadGradedMastery, skillRating } from "./gradeProgress";

// A finished run, plus the context and derived outcome that decide where it's remembered.
export type RecordedRun = {
    id: string;
    title: string;
    // When set, the run is the day's shared challenge: it marks the daily done and keeps
    // its result so re-opening shows it rather than a blank slate.
    daily?: number;
    // A throwaway piece (a generated sprint): it counts toward history but is not tracked
    // for ghosts or spaced repetition.
    ephemeral?: boolean;
    // A run that began partway through (a takeover from Listen) keeps no ghost — a partial
    // replay would strand the next race at its early end.
    partial: boolean;
    notes: OutcomeNote[];
    // The positions cleared, counted toward the practice history.
    correct: number;
    grade: Grade;
    grid: Grid;
    tolerance: number;
};

// Fold a finished run into every place that remembers it — the lifetime fingerprint, the
// daily challenge, the practice history, this score's ghost, and its spaced-repetition
// mastery — then surface at most one earned moment on the milestone channel. This is the
// single place a completed run is written: the play surface only produces the run and
// hands it here. Time and the milestone publisher arrive as parameters, so the whole
// recording path is testable against an in-memory service world.
//
// Returns the run's onsets when they become this score's new ghost (a full, non-ephemeral
// run), so the caller can mirror them for the share button — or null when the ghost is
// left as it was.
export function recordRun(
    run: RecordedRun,
    services: AppServices,
    now: number,
    publishMilestone: (milestone: Milestone) => void,
): { ghost: number[] | null } {
    const { id, title, daily, ephemeral, partial, notes, correct, grade, grid, tolerance } = run;
    services.lifetime.recordRun({
        accuracy: grade.accuracy,
        timing: grade.timing,
        flow: grade.flow,
    });
    if (daily != null) {
        services.daily.recordDone(daily);
        services.daily.saveResult(daily, { grade, grid, notes, tolerance });
    }
    services.history.record(correct);
    if (ephemeral) {
        return { ghost: null };
    }
    const ghost = partial ? null : notes.map((note) => note.playedMs);
    if (ghost) {
        services.ghosts.save(id, ghost);
    }
    // Fold the run into spaced repetition: a score that clears the threshold becomes
    // learned and schedules (or reschedules) its review.
    const before = services.mastery.load(id);
    const threshold = letterMin(services.prefs.load().masteryThreshold);
    services.mastery.save(id, applyRun(before, grade.score, threshold, now));

    // Surface one earned moment. Grade-up is the biggest, so it wins a tie; the others it
    // pre-empts can still fire on a later run (a flawless run keeps its one-time flag; a
    // song's first S is guarded by its best score, so a grade-up that buries it is a rare,
    // accepted loss). The first-S and flawless checks are decided here from the mastery just
    // written; the grade-up check reads the ladder across the whole catalogue, so it
    // resolves asynchronously.
    const firstS = isFirstS(grade.score, before?.bestScore ?? 0);
    const flawlessNow = isFlawless(grade) && !services.milestones.flawlessDone();
    const decayMode = services.prefs.load().decayMode;
    loadGradedMastery(services.mastery, services).then((items) => {
        const reached = currentGrade(items);
        if (reached > services.milestones.reachedGrade()) {
            services.milestones.recordReachedGrade(reached);
            publishMilestone({
                kind: "grade-up",
                grade: reached,
                skill: skillRating(items, decayMode, now),
            });
        } else if (flawlessNow) {
            services.milestones.recordFlawless();
            publishMilestone({ kind: "flawless", songTitle: title });
        } else if (firstS) {
            publishMilestone({ kind: "first-s", songTitle: title });
        }
    });
    return { ghost };
}
