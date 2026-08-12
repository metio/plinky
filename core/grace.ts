// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where an ornament falls in time.
//
// A grace note is printed at the same moment as the note it decorates — the engraver
// gives them one position, and a cursor walking the score hands both back at once. Read
// literally that is a chord: two keys down together. It is the opposite of what the score
// says, which is to play the little note and then the big one, and on a run it is
// unplayable — the player does what is written and the ornament reads as a wrong note
// against the principal.
//
// So an ornament is its own step, and needs its own moment. Grace notes are quick and
// they belong to the note they decorate, so they are placed just before it, each taking
// its own written length, and squeezed together when there is not room for all of them.
//
// A caveat worth stating: an appoggiatura (a grace note without the slash) is properly
// played ON the beat, taking its time from the principal rather than from the space
// before it. Both are measured here as time before the beat. The difference is a matter
// of a fraction of a beat at the ornament itself, and getting the order right is what
// makes the passage playable at all.

// The most of the gap to the previous note an ornament may take. A grace note is quick
// and sits close to what it decorates; spreading it evenly back toward the previous note
// would ask the player to begin the ornament long before the beat.
export const GRACE_MAX_SHARE = 0.5;

// When to strike each note of an ornament, in milliseconds on the same clock as the
// principal it decorates. `lengthsMs` are the ornament's own written lengths in order;
// the result is in the same order and always earlier than the principal, never earlier
// than the note before it.
export function graceOnsetsMs(
    principalMs: number,
    previousMs: number,
    lengthsMs: readonly number[],
): number[] {
    if (lengthsMs.length === 0) {
        return [];
    }
    const wanted = lengthsMs.reduce((sum, length) => sum + Math.max(0, length), 0);
    const room = Math.max(0, principalMs - previousMs) * GRACE_MAX_SHARE;
    // Squeezed to fit when the ornament is longer than the space before its principal —
    // which is the ordinary case for a run of grace notes at speed.
    const scale = wanted > 0 && wanted > room ? room / wanted : 1;

    const onsets: number[] = [];
    let at = principalMs - wanted * scale;
    for (const length of lengthsMs) {
        onsets.push(at);
        at += Math.max(0, length) * scale;
    }
    return onsets;
}
