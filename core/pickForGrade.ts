// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MusicItem } from "./music";

// Choosing a piece on somebody's behalf.
//
// A library of three thousand pieces is a wall to a beginner, and a practice suggestion that
// ends at "go and find something" is advice rather than practice. The grade is already known,
// so the app can simply produce a piece and open it.
//
// The choice is seeded rather than random. Two reasons, and the second is the load-bearing
// one: a seeded pick is testable at all, and a re-render must not silently swap the piece
// under a button somebody is reading. The caller decides what the seed means — a date makes
// the choice hold for a day, a counter makes a "something else" button.

export type PickPreferences = {
    // Pieces to keep out of the running — most usefully whatever was just played, so a
    // suggestion does not hand back the piece somebody has finished with.
    exclude?: ReadonlySet<string>;
    // Ids the player has some history with. Untried pieces are preferred, because the point
    // of being handed a piece is meeting one, but this is a preference and not a filter:
    // running out of new pieces must produce an old piece rather than nothing.
    played?: ReadonlySet<string>;
    kind?: MusicItem["kind"];
};

// A small integer hash, so the same seed and the same shelf always choose the same piece and
// neighbouring seeds do not choose neighbouring pieces.
function hash(seed: string): number {
    let value = 2166136261;
    for (let at = 0; at < seed.length; at++) {
        value ^= seed.charCodeAt(at);
        value = Math.imul(value, 16777619);
    }
    return value >>> 0;
}

// Everything at a grade that the preferences allow, in the catalogue's own order — the caller
// may want to count them, or say how much is left to meet.
export function candidatesForGrade(
    items: readonly MusicItem[],
    grade: number,
    preferences: PickPreferences = {},
): MusicItem[] {
    return items.filter(
        (item) =>
            item.grade === grade &&
            !preferences.exclude?.has(item.id) &&
            (preferences.kind === undefined || item.kind === preferences.kind),
    );
}

// One piece at the given grade, or undefined when the grade holds nothing the preferences
// allow — a caller has to be able to say "nothing here" rather than be handed a wrong piece.
export function pickForGrade(
    items: readonly MusicItem[],
    grade: number,
    seed: string,
    preferences: PickPreferences = {},
): MusicItem | undefined {
    const allowed = candidatesForGrade(items, grade, preferences);
    if (allowed.length === 0) return undefined;
    // Prefer what has never been played, and fall back to the whole grade rather than to
    // nothing: somebody who has worked through a grade should still be handed a piece.
    const fresh = preferences.played
        ? allowed.filter((item) => !preferences.played?.has(item.id))
        : allowed;
    const pool = fresh.length > 0 ? fresh : allowed;
    return pool[hash(seed) % pool.length];
}
