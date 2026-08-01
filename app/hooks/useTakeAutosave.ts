// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useMemo, useRef } from "react";
import type { Grade } from "../../core/grade";
import { flushHolds, type RunCapture } from "../../core/runCapture";
import { compositionFromRun, type RunStep, type Take } from "../../core/takes";

// Keeping a finished run without anyone pressing Save. Finishing a piece and later
// finding Runs empty reads as losing something you did, so the take is written for
// you — but only once, and only after the last key comes up.
//
// The waiting is the point. A note still down when the run completes has not had its
// key-up yet, so saving at that moment records the beat the piece ended on rather
// than how long the note was actually held. The save therefore waits for the release.
//
// Which leaves three ways out of a run with a save still owed, and all three have to
// take it before the capture they would read is replaced:
//
//   1. the last key comes up          — the ordinary path, the effect below
//   2. the player leaves the surface  — still holding that note
//   3. the player starts another run  — Practice or Restart, still holding it
//
// One latch covers all three, so a run is saved once however it ends. Paths 2 and 3
// call saveIfOwed before they tear anything down; each closes the open hold at that
// instant, which is the honest length — the note stopped when the player stopped.

export type TakeAutosaveOptions = {
    // The run's state, as the matcher and the key-tracker report it.
    complete: boolean;
    holdingNote: boolean;
    // A daily or a placement drill is played and graded but never kept as a take:
    // it is not this piece's own run.
    ephemeral?: boolean;
    // The capture the take is built from, mutated in place as the run is played.
    capture: { current: RunCapture };
    // The run's tempo and meter, which the rebuilt composition is timed against.
    tempo: number;
    beatsPerBar?: number;
    // The grade the run earned, read at save time rather than passed in: grading
    // records into state a render later, so the value here is the fresher one.
    finishedGrade: () => Grade | null;
    // Where a take goes, and how the surface is told whether the write landed.
    save: (take: Take) => boolean;
    onSaved: (stored: boolean) => void;
    // The run clock the holds are stamped on — the same one that opened them.
    now: () => number;
    // Identity and wall-clock, injected so a test can pin what was written.
    newId?: () => string;
    createdAt?: () => number;
};

export type TakeAutosave = {
    // Save the finished run if one is still owed. Called on the ways out that would
    // otherwise replace the capture before the deferred save could read it.
    saveIfOwed: () => void;
    // Save what is captured now, whatever the run's state — the Save button on the
    // results panel, which the player pressed on purpose and the latch does not gate.
    saveNow: (grade: Grade | null) => void;
    // A new run begins: the next finish owes its own take.
    reset: () => void;
};

export function useTakeAutosave(options: TakeAutosaveOptions): TakeAutosave {
    const savedRef = useRef(false);
    const latest = useRef(options);
    latest.current = options;

    const api = useMemo<TakeAutosave>(() => {
        // Rebuild the performance from the captured steps: their played onsets,
        // pitches and velocity, plus each note's real hold where one was measured.
        const write = (grade: Grade | null) => {
            const o = latest.current;
            const steps: RunStep[] = o.capture.current.notes.map((note) => ({
                pitches: note.pitches,
                startMs: note.playedMs,
                velocity: note.velocity,
                heldMs: note.heldMs,
                // The notated onset, so a note with no measured hold can't ring longer
                // than the score says while the player hunts for the next key.
                targetMs: note.targetMs,
            }));
            if (steps.length === 0) {
                return;
            }
            const take: Take = {
                id: (o.newId ?? (() => crypto.randomUUID()))(),
                createdAt: (o.createdAt ?? Date.now)(),
                letter: grade?.letter ?? "",
                complete: o.complete,
                metrics: grade,
                composition: compositionFromRun(
                    steps,
                    o.tempo,
                    o.beatsPerBar ?? 4,
                    o.capture.current.imprecise,
                ),
            };
            o.onSaved(o.save(take));
        };
        return {
            saveIfOwed: () => {
                const o = latest.current;
                if (!o.complete || o.ephemeral || savedRef.current) {
                    return;
                }
                savedRef.current = true;
                flushHolds(o.capture.current, o.now());
                write(o.finishedGrade());
            },
            saveNow: write,
            reset: () => {
                savedRef.current = false;
            },
        };
    }, []);

    // The ordinary path: the run is complete and the player has let go. The guard is
    // spelled out here rather than left to saveIfOwed, so that every value it turns on
    // is a value this effect visibly depends on — a run finishing with no key still
    // down has to wake it, and it would not if `complete` were not read.
    useEffect(() => {
        if (!options.complete || options.ephemeral || options.holdingNote) {
            return;
        }
        api.saveIfOwed();
    }, [options.complete, options.ephemeral, options.holdingNote, api]);

    return api;
}
