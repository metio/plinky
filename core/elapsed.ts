// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// When each position of a performance actually happens, as opposed to where it is
// printed on the page. Two things make those different, and both of them are written
// into the score.
//
// A repeat plays bars over again, and a position's notated onset — counted from the top
// of the piece — rewinds with it: 0, 1, 0, 1, 2. Reading that as the moment a note is
// due puts the whole second pass before the first, so a player who repeats exactly as
// written is measured against onsets that run backwards. First and second endings do the
// same thing forwards, skipping a bar of notated time that is never performed.
//
// A tempo mark changes what a bar is worth. Half a page at 120 and half at 60 is not
// evenly spaced time, and a fermata says to wait at one note for as long as the player
// judges right. Counting in notes rather than milliseconds silently grades a ritardando
// as a mistake.
//
// So this walks the performance in order and accumulates real elapsed milliseconds, at
// the tempi the score writes. Between two positions that follow each other on the page,
// the gap in notes is the difference in their onsets. Where the music jumps — back to a
// repeat sign, forward past an ending — there is no such difference to take, and the gap
// is what the previous position was going to last anyway. The dial the player sets is
// applied later, as a ratio against the opening tempo, so the shape the composer wrote
// survives at any speed.

export type Position = {
    // The notated onset in whole notes from the top of the piece: the printed location,
    // which repeats revisit.
    whole: number;
    // How long until the next onset, in quarter notes — the SHORTEST note or rest here,
    // the same measure playback advances the cursor by. Used only across a jump, where
    // the printed onsets say nothing about the gap.
    advanceQuarters: number;
    // The tempo in force here, in beats per minute.
    bpm: number;
    // How much longer than written this position is held — 1 ordinarily, more under a
    // fermata.
    stretch: number;
};

// A tempo to count in when the score marks none. Any constant would do, since the
// player's dial is then read against the same number and cancels it out; a quarter note
// per second keeps the intermediate values readable.
export const NOMINAL_BPM = 60;

// How much longer a fermata holds. The score says to wait, not how long — the judgement
// is the performer's, and part of what makes a fermata expressive. Twice the written
// length is the usual thing a teacher asks for, and it is generous enough that a player
// who lingers is not marked down for it.
export const FERMATA_STRETCH = 2;

// The notes between two positions adjacent in the performance: the difference in their
// printed onsets where the music runs on, and what the earlier one was going to last
// where it jumps.
function gapWholes(previous: Position, current: Position): number {
    const printed = current.whole - previous.whole;
    const advance = previous.advanceQuarters / 4;
    // A gap that does not move forward on the page is a jump, and so is one that outruns
    // what the previous position could possibly have lasted.
    return printed > 0 && printed <= advance + EPSILON ? printed : advance;
}

// Elapsed milliseconds at each position, index-aligned with the input, counted from the
// first position and at the tempi the score writes. Scale by the ratio between the
// player's dial and the opening tempo to get the run's own clock.
export function writtenOnsetsMs(positions: readonly Position[]): number[] {
    const onsets: number[] = [];
    let running = 0;
    let previous: Position | undefined;
    for (const position of positions) {
        if (previous !== undefined) {
            // The stretch belongs to the position being left: a fermata delays what
            // follows it, and nothing before it.
            running += quartersMs(
                gapWholes(previous, position) * 4 * previous.stretch,
                previous.bpm,
            );
        }
        onsets.push(running);
        previous = position;
    }
    return onsets;
}

// What a stretch of quarter notes lasts at a tempo, in milliseconds.
export function quartersMs(quarters: number, bpm: number): number {
    return quarters * (60_000 / Math.max(1, bpm));
}

// Onsets are exact binary fractions of a whole note in every ordinary metre, but a
// triplet is a third, so the comparison needs room for a rounded value.
const EPSILON = 1e-6;
