// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useRef } from "react";
import { cadence } from "../../core/cadence";
import type { Grade } from "../../core/grade";
import { flushHolds, type RunCapture } from "../../core/runCapture";
import { deriveRunOutcome, type RunOutcome, tempoScale } from "../../core/runOutcome";
import { sectionScores } from "../../core/sectionBest";
import type { AppServices } from "../contexts/services";
import { recordRun } from "../lib/recordRun";
import type { Milestone } from "../../core/milestones";

// What happens the moment a self-paced run finishes: it is scored, the score is
// written everywhere a run is remembered, and the result is announced.
//
// Held apart from the play surface because none of it needs the surface. The
// decision reads a handful of counters and the captured notes — not the engraved
// score, not the cursor, not OSMD — so keeping it here lets a test drive a whole
// finished run through fakes in jsdom, where mounting the real thing would need a
// browser and a rendered staff.
//
// The order below is load-bearing. The grade is derived first and latched before
// anything can re-enter, so a re-render mid-effect cannot score one run twice; the
// take is saved separately once the last key comes up, and reads the grade this
// hook latched.

export type RunGradingOptions = {
    // The matcher's finished-run counters. `complete` turning true is what fires this.
    complete: boolean;
    correct: number;
    wrong: number;
    // The run's captured notes, read at completion. A ref because the capture is
    // mutated in place as the run is played.
    capture: { current: RunCapture };
    // The tempo the run was matched at, and the tempo the piece intends — their ratio
    // is how speed is scored, so a slow careful run cannot read as an at-tempo one.
    runTempo: { current: number };
    intendedTempo?: number;
    // Whether the run began partway through the piece, which keeps it out of the
    // sight-reading record: a takeover from Listen has already been read to you.
    partial: { current: boolean };

    // Where the piece and the run are recorded.
    id: string;
    title: string;
    daily?: number;
    ephemeral?: boolean;
    assessment?: boolean;
    looped: boolean;
    sightReading: boolean;
    atTempo: boolean;

    // Whether any key is still down. The run is not over while one is: the final note
    // has not finished sounding, and its length is what the expressive reading is
    // judged on. Grading waits for the keys to come up, the way the take autosave and
    // the full-screen exit already do.
    holdingNote: boolean;
    services: AppServices;
    // Sounds the finishing flourish. Muted playback no-ops inside the engine.
    playNote: (
        note: number,
        options: { velocity: number; duration: number; delay: number },
    ) => void;
    publishMilestone: (milestone: Milestone) => void;
    recordResult: (result: RunOutcome & { notes: RunCapture["notes"] }) => void;
    bumpTempo: () => void;
    adoptOwnRun: (onsets: number[]) => void;
    onGraded?: (grade: Grade) => void;
    onRunComplete?: () => void;
    // The wall clock, injected so a test can pin what a run was stamped with.
    now?: () => number;
};

export type RunGrading = {
    // Grade the finished run now, if it has not been graded already. Called when the
    // last key comes up, and again by the run's teardown so a run left with a key held
    // down still earns its grade on the way out.
    gradeIfOwed: () => void;
    // Whether the result on screen was earned by a run just played, rather than
    // seeded or restored — only the former is worth celebrating.
    fromRun: () => boolean;
    // The grade the finished run earned, for the take saved once the keys come up.
    finishedGrade: () => Grade | null;
    // A new run begins: forget the last one's verdict so it can be scored afresh.
    reset: () => void;
};

export function useRunGrading(options: RunGradingOptions): RunGrading {
    const gradedRef = useRef(false);
    const gradeFromRunRef = useRef(false);
    const finishedGradeRef = useRef<Grade | null>(null);

    // Read through a ref so the effect fires on the run finishing rather than on
    // every change to the twenty things it needs when it does.
    const latest = useRef(options);
    latest.current = options;

    const gradeIfOwed = useCallback(() => {
        const o = latest.current;
        if (!o.complete || gradedRef.current) {
            return;
        }
        gradedRef.current = true;
        const now = o.now ?? Date.now;
        // Close every hold still open — the final note, and anything still ringing under
        // the pedal — at this instant, which is when the player stopped. Accuracy,
        // timing and flow were settled the moment the last note was matched, but the
        // expressive reading is judged on how long each key was actually down, and a
        // note graded before its release has no length to read. Idempotent: the take
        // autosave flushes too, and the second call finds nothing open.
        flushHolds(o.capture.current, now());
        const notes = o.capture.current.notes;
        const intended = o.intendedTempo ?? o.runTempo.current;
        const scale = tempoScale(o.runTempo.current, intended);
        const outcome = deriveRunOutcome({
            notes,
            correct: o.correct,
            wrong: o.wrong,
            imprecise: o.capture.current.imprecise,
            intendedTempo: intended,
            runTempo: o.runTempo.current,
        });
        gradeFromRunRef.current = true;
        finishedGradeRef.current = outcome.grade;
        o.recordResult({ ...outcome, notes });
        // A short major flourish for finishing — fuller for a stronger grade, a gentle
        // lift for a weaker one, never a penalty.
        for (const beat of cadence(outcome.grade.letter)) {
            o.playNote(beat.note, {
                velocity: beat.velocity,
                duration: beat.duration,
                delay: beat.at,
            });
        }
        o.bumpTempo();
        const { ghost: newGhost } = recordRun(
            {
                id: o.id,
                title: o.title,
                daily: o.daily,
                ephemeral: o.ephemeral,
                partial: o.partial.current,
                looped: o.looped,
                assessment: o.assessment,
                // Scored on the same terms the share grid uses, so "your best section"
                // and the grid's cells can never disagree about how a moment went.
                sections: sectionScores(notes, {
                    tolerance: outcome.tolerance,
                    tempoScale: scale,
                }),
                notes,
                correct: o.correct,
                grade: outcome.grade,
                grid: outcome.grid,
                tolerance: outcome.tolerance,
            },
            o.services,
            now(),
            o.publishMilestone,
        );
        if (newGhost) {
            o.adoptOwnRun(newGhost);
        }
        // A sight-read is remembered apart from mastery: mastery tracks the best a piece
        // has ever been played, this records how it went the one time it was new. Only a
        // full run counts, and the store keeps the first, so a second read never
        // overwrites it.
        if (o.sightReading && !o.ephemeral && !o.partial.current) {
            o.services.sightReads.record(o.id, {
                score: outcome.grade.score,
                letter: outcome.grade.letter,
                atTempo: o.atTempo,
                playedAt: now(),
            });
        }
        o.onGraded?.(outcome.grade);
        if (!o.ephemeral) {
            o.onRunComplete?.();
        }
    }, []);

    // The ordinary path: the run is complete and the player has let go. Spelled out here
    // rather than left to gradeIfOwed so every value it turns on is one this effect
    // visibly depends on — the same shape the take autosave uses, for the same reason.
    useEffect(() => {
        if (!options.complete || options.holdingNote) {
            return;
        }
        gradeIfOwed();
    }, [options.complete, options.holdingNote, gradeIfOwed]);

    // One object for the hook's whole life. Each accessor reads a ref, so nothing here
    // depends on a render — and a caller may list `grading` in an effect's dependencies
    // without that effect firing again on every render.
    return useMemo(
        () => ({
            gradeIfOwed,
            fromRun: () => gradeFromRunRef.current,
            finishedGrade: () => finishedGradeRef.current,
            reset: () => {
                gradedRef.current = false;
                gradeFromRunRef.current = false;
                finishedGradeRef.current = null;
            },
        }),
        [gradeIfOwed],
    );
}
