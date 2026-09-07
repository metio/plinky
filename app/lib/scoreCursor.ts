// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

// Walks the cursor to its `ordinal`-th position from the top. The one seek that lands
// on the right pass of a repeat: a printed onset names two places there, and a step
// records which cursor position it was read from.
export function seekToOrdinal(cursor: CursorLike, ordinal: number): void {
    cursor.reset();
    for (let taken = 0; taken < ordinal && !cursor.iterator.EndReached; taken++) {
        cursor.next();
    }
}

// Which position the cursor stands on, counted from the top — what seekToOrdinal puts
// back. OSMD's iterator counts nothing, so it is measured by walking to the end from
// here and again from the top; the cursor is left reset, and a caller that wants it
// where it was seeks it back.
export function cursorOrdinal(cursor: CursorLike): number {
    let ahead = 0;
    while (!cursor.iterator.EndReached) {
        cursor.next();
        ahead += 1;
    }
    cursor.reset();
    let total = 0;
    while (!cursor.iterator.EndReached) {
        cursor.next();
        total += 1;
    }
    cursor.reset();
    return total - ahead;
}

// Runs a walk that leaves the cursor reset — every collector does — and puts the cursor
// back where it stood. A walk taken while a transport is driving the cursor otherwise
// drops it to the top: Listen highlighted one note behind the music for a whole piece,
// and left the last note of every repeated section blue, because the sample prefetch
// walked the score once the full-screen relayout had finished. The position is measured
// as an ordinal, the one place that names a pass through a repeat.
export function withCursorKept<T>(cursor: CursorLike, walk: () => T): T {
    const ended = cursor.iterator.EndReached;
    const standing = cursorOrdinal(cursor);
    try {
        return walk();
    } finally {
        if (ended) {
            seekToOrdinal(cursor, Number.MAX_SAFE_INTEGER);
        } else {
            seekToOrdinal(cursor, standing);
        }
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
