// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where each position of a performance falls in TIME, as opposed to where it is printed
// on the page.
//
// A repeat makes those two different things. The cursor plays bar 1, bar 2, then bar 1
// and bar 2 again — and a position's notated onset, counted from the top of the piece,
// rewinds with it: 0, 1, 0, 1, 2. Reading that as the moment a note is due puts the whole
// second pass before the first, so a player who repeats exactly as written is measured
// against onsets that run backwards and every note of the second time round reads as
// wildly late. First and second endings do the same thing forwards, skipping a bar of
// notated time that is never performed.
//
// This walks the performance in order and accumulates real elapsed time instead. Between
// two positions that follow each other on the page, the gap is simply the difference in
// their onsets. Where the music jumps — back to a repeat sign, forward past an ending —
// there is no such difference to take, and the gap is what the previous position was
// going to last anyway.

export type Position = {
    // The notated onset in whole notes from the top of the piece: the printed location,
    // which repeats revisit.
    whole: number;
    // How long until the next onset, in quarter notes — the SHORTEST note or rest here,
    // the same measure playback advances the cursor by. Used only across a jump, where
    // the printed onsets say nothing about the gap.
    advanceQuarters: number;
};

// Elapsed whole notes at each position, index-aligned with the input and beginning at the
// first position's own onset, so a piece that plays straight through is unchanged and the
// numbers still read as a place in the score.
export function elapsedWholes(positions: readonly Position[]): number[] {
    const elapsed: number[] = [];
    let running = positions[0]?.whole ?? 0;
    let previous: Position | undefined;
    for (const position of positions) {
        if (previous !== undefined) {
            const printed = position.whole - previous.whole;
            // A gap that does not move forward on the page is a jump, and so is one that
            // outruns what the previous position could possibly have lasted.
            const advance = previous.advanceQuarters / 4;
            running += printed > 0 && printed <= advance + EPSILON ? printed : advance;
        }
        elapsed.push(running);
        previous = position;
    }
    return elapsed;
}

// Onsets are exact binary fractions of a whole note in every ordinary metre, but a
// triplet is a third, so the comparison needs room for a rounded value.
const EPSILON = 1e-6;
