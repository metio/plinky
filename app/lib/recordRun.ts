// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Grade } from "../../core/grade";
import { applyRun, letterMin } from "../../core/mastery";
import { isFirstS, isFlawless, type Milestone } from "../../core/milestones";
import type { CapturedNote } from "../../core/runCapture";
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
    // A run that drilled a bar range on repeat. Its notes cover a slice of the piece,
    // so its sections are not the same stretches of music a whole run's are.
    looped?: boolean;
    // A run whose difficulty was chosen to find the player's limit rather than to
    // practise at it. Its reading times describe the material, not the reader.
    assessment?: boolean;
    // The run's per-section scores, for the piece's section-wise best.
    sections: number[];
    // Captured rather than merely scored: the per-note reading times need to know
    // which pitches a step sounded, which the outcome type drops.
    notes: CapturedNote[];
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
    const {
        id,
        title,
        daily,
        ephemeral,
        partial,
        looped,
        assessment,
        sections,
        notes,
        correct,
        grade,
        grid,
        tolerance,
    } = run;
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
    // How long this run took, folded into the practice diary. Onsets count from the
    // run's first cleared note, so the last one is the run's length; the diary decides
    // for itself whether that extends the sitting in progress or opens a new one.
    //
    // A generated drill still contributes its minutes — time at the keyboard is time at
    // the keyboard — but carries no piece id, because it has no catalogue entry the
    // report could name.
    services.practiceLog.record({
        at: now,
        activeMs: notes.at(-1)?.playedMs ?? 0,
        notes: correct,
        pieceId: ephemeral ? undefined : id,
    });
    // Which notes this run was slow to find, folded into the running per-note record.
    // Ephemeral runs count: a generated drill reads the staff exactly as a piece does,
    // and it is reading that is being measured.
    //
    // An assessment does not. The placement test climbs until the player fails, so its
    // closing rungs are material above their level by construction — a long gap there
    // says the drill was too hard, not that the note is hard to find, and folding it in
    // would file that difficulty under whichever pitches the overshoot happened to use.
    if (!assessment) {
        services.noteStats.record(notes);
    }
    if (ephemeral) {
        return { ghost: null };
    }
    // The section-wise best only takes whole, unlooped readings. Sections are cut by
    // position within the run, so a takeover from Listen or a drilled bar range would
    // file a different stretch of music under the same section number and quietly
    // corrupt the record it is compared against.
    if (!partial && !looped) {
        services.sectionBest.record(id, sections);
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
