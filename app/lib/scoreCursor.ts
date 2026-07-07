// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Position helpers for OSMD's visual cursor. OSMD has no direct seek, so every
// jump is a reset + walk; these are the walks Listen, play-along and the
// fingering re-render all share. Typed structurally against the slice of the
// cursor they read, so a test drives them with a plain stub.

export type CursorLike = {
    reset(): void;
    next(): void;
    iterator: {
        EndReached: boolean;
        CurrentMeasureIndex: number;
        currentTimeStamp?: { RealValue: number };
    };
};

// The cursor's current position in whole notes from the top of the piece — the
// shared place Listen and Practice hand off at. A cursor that has run off the
// end (or no cursor at all) carries no resume point: the run is over, so the
// next start begins at the top, which reads as 0 — the same as a fresh score.
export function cursorWhole(cursor: CursorLike | null | undefined): number {
    const iterator = cursor?.iterator;
    if (!iterator || iterator.EndReached) {
        return 0;
    }
    return iterator.currentTimeStamp?.RealValue ?? 0;
}

// Walk the cursor to the first voice-entry of a 1-based bar, from a clean reset.
export function seekToBar(cursor: CursorLike, bar: number): void {
    cursor.reset();
    while (!cursor.iterator.EndReached && cursor.iterator.CurrentMeasureIndex < bar - 1) {
        cursor.next();
    }
}

// Walk the cursor to the first voice-entry at or after a notated onset in whole
// notes — resuming from a handed-off position.
export function seekToWhole(cursor: CursorLike, whole: number): void {
    cursor.reset();
    while (
        !cursor.iterator.EndReached &&
        (cursor.iterator.currentTimeStamp?.RealValue ?? 0) < whole
    ) {
        cursor.next();
    }
}

// The notated lengths under the cursor as quarter-note counts — what a playback
// step dwells on. Rests count too, so a written gap keeps its own length.
export function stepLengths(notes: Iterable<{ Length: { RealValue: number } }>): number[] {
    const lengths: number[] = [];
    for (const note of notes) {
        lengths.push(note.Length.RealValue * 4);
    }
    return lengths;
}
