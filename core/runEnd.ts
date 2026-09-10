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
