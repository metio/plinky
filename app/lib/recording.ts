// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A "ghost": the note onset times of a completed run on a score, each in ms from
// the run's first note, ascending. Replaying the clock against these lets a later
// attempt race the earlier one, Mario-Kart style. The shape is plain JSON so the
// same recording can later be shared with a friend to race against.

const key = (scoreId: string) => `plinky:ghost:${scoreId}`;

export function saveGhost(scoreId: string, onsets: number[]): void {
    try {
        localStorage.setItem(key(scoreId), JSON.stringify(onsets));
    } catch {
        // A ghost is a convenience; a failed write is not surfaced.
    }
}

export function loadGhost(scoreId: string): number[] | null {
    try {
        const raw = localStorage.getItem(key(scoreId));
        if (!raw) {
            return null;
        }
        const value = JSON.parse(raw);
        return Array.isArray(value) && value.every((onset) => typeof onset === "number")
            ? value
            : null;
    } catch {
        return null;
    }
}

// How many notes the ghost has reached by a given elapsed time. The onsets ascend,
// so the first one still in the future ends the count.
export function ghostReached(onsets: number[], elapsedMs: number): number {
    let reached = 0;
    for (const onset of onsets) {
        if (onset > elapsedMs) {
            break;
        }
        reached += 1;
    }
    return reached;
}
