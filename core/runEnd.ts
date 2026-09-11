// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// When a finished run is over.
//
// The matcher calls a run complete the moment its last position clears, but the player
// may still be holding that note, and its length is part of what was played. So the run
// is only settled once every key is up. Its grade, its kept take and the drop out of full
// screen all wait for that moment, and they share this one rule so they cannot disagree
// about when it arrives.
//
// The completion has to belong to the run it describes. A new run, a play-along or Listen
// taking the stage makes it stale, and the surface forgets it at that point. A completion
// left standing would read as settled to every consumer here, closing the full screen the
// next run has just opened.

export type RunEnding = {
    // The matcher cleared the run's last position.
    complete: boolean;
    // Any key is still down.
    holdingNote: boolean;
};

export function runSettled({ complete, holdingNote }: RunEnding): boolean {
    return complete && !holdingNote;
}

// Ending a finished run because something else is taking the stage. Its grade and its
// take both wait on the keys coming up and both read the completion, so they are settled
// while it still stands; only then is it forgotten. The other order grades nothing and
// saves nothing, since a run no longer complete owes neither.
export function settleFinishedRun(run: {
    grade: () => void;
    save: () => void;
    forget: () => void;
}): void {
    run.grade();
    run.save();
    run.forget();
}

export type GradeClaim = {
    // The matcher cleared the run's last position.
    complete: boolean;
    // This run has already been graded.
    graded: boolean;
    // Positions the matcher cleared, the ones the forgiving advance moved past included,
    // and notes the capture holds. Cleared rather than graded right: a skipped position is
    // a miss in the tally, yet the capture still holds whatever was played there.
    cleared: number;
    captured: number;
};

// Whether a finished run is still owed its grade.
//
// The counters come from the matcher and the notes from the capture, and they are two
// halves of one run only while they agree. A run that cleared positions yet has no notes
// captured is pairing one run's counters with the next run's fresh capture: graded, it
// would be written to history and mastery a second time, and its empty onset list would
// replace the ghost the player races. A run that cleared nothing has nothing to capture,
// and is still graded.
export function owesGrade({ complete, graded, cleared, captured }: GradeClaim): boolean {
    return complete && !graded && (cleared === 0 || captured > 0);
}
