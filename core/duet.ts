// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The self-paced duet: while you play one hand note-by-note, the app sounds the
// other hand for you. Self-paced practice has no clock — the run advances only
// when you play — so the sitting-out hand is scheduled a gap at a time. Each time
// you clear one of your notes, the notes the other hand owes between that note and
// your next one are laid out ahead at your current pace; playing your next note
// re-locks the schedule, so the accompaniment can drift within a single gap but
// never runs away from you.

// One note the accompanying hand must sound: its pitch, its notated onset in whole
// notes from the top of the piece, and its written length in quarter notes.
export type AccompanyVoice = {
    pitch: number;
    whole: number;
    // Where the note falls in TIME, milliseconds from the start of the performance with the
    // repeats played out. Which gap a note belongs to is decided on this rather than on
    // `whole`: a repeat prints the same bars twice, so an onset names two moments and a
    // range between two of them can run backwards.
    elapsedMs: number;
    quarters: number;
};

// A note to sound for the accompaniment: how long from now to wait (0 = with your
// note) and how long to hold it, both already resolved against the live tempo.
// Two elapsed times this close are the same moment; the walk sums them in fractions.
const MS_EPSILON = 1e-6;

export type ScheduledVoice = {
    pitch: number;
    delayMs: number;
    durationSec: number;
};

// Lay out the accompanying hand's notes for the gap opened by clearing one of your
// notes. `fromWhole` is that note's onset, `toWhole` the onset of your next note
// (`Infinity` for your last note, so the tail of the piece still sounds). A note on
// `fromWhole` sounds with yours (delay 0); notes strictly inside the gap are spaced
// at `bpm`; notes at or past `toWhole` belong to the next gap and are left for it.
//
// `isFirst` sweeps up any pickup the accompanying hand plays before your very first
// note — those onsets sit before `fromWhole`, so their delay clamps to 0 and they
// sound as you begin rather than being lost.
// Which of your gaps each of the accompanying hand's notes belongs to, as one bucket per
// note of yours.
//
// Decided on elapsed time, which rises across the whole run. Deciding it on the printed
// onset — the range between your note and your next — broke twice over on a repeat: the
// same bars are printed once and walked twice, so every note of theirs printed in a
// repeated bar matched BOTH passes' gaps and sounded twice, and the gap spanning the
// repeat barline ran from a later onset to an earlier one, matched nothing, and fell
// silent exactly at the turn.
//
// Anything the accompaniment plays before your first note is a pickup and belongs to the
// first gap, where its delay clamps to zero and it sounds as you begin.
export function gapsForRun(
    mine: readonly { elapsedMs: number }[],
    theirs: readonly AccompanyVoice[],
): AccompanyVoice[][] {
    const buckets: AccompanyVoice[][] = mine.map(() => []);
    if (buckets.length === 0) {
        return buckets;
    }
    let at = 0;
    for (const voice of theirs) {
        // Both walks are in play order, so this pointer only ever moves forward.
        while (at + 1 < mine.length && voice.elapsedMs >= mine[at + 1]!.elapsedMs - MS_EPSILON) {
            at++;
        }
        buckets[at]!.push(voice);
    }
    return buckets;
}

// Lay out one gap's notes at your current pace. `fromWhole` is the onset of the note of
// yours that opened it: a note printed with yours sounds with it, and the rest are spaced
// by how much later they are written.
//
// Which notes are in the gap is settled by gapsForRun, so nothing is filtered here. A note
// printed before the gap's start — a pickup, or the far side of a repeat barline — clamps
// to zero and sounds as the gap opens, which is the only sensible reading of "already due".
export function accompanimentForGap(
    voices: readonly AccompanyVoice[],
    fromWhole: number,
    bpm: number,
): ScheduledVoice[] {
    // A non-positive tempo would divide by zero; the caller clamps the live tempo, but
    // guard so a stray value can't schedule notes at infinity.
    const msPerQuarter = 60000 / Math.max(bpm, 1);
    return voices.map((voice) => ({
        pitch: voice.pitch,
        delayMs: Math.max(0, voice.whole - fromWhole) * 4 * msPerQuarter,
        // A note the score marks with no length still needs an audible tail; fall back to a
        // quarter so it sounds like a played note, not a click.
        durationSec: (voice.quarters || 1) * (msPerQuarter / 1000),
    }));
}
