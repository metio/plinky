// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
    quarters: number;
};

// A note to sound for the accompaniment: how long from now to wait (0 = with your
// note) and how long to hold it, both already resolved against the live tempo.
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
export function accompanimentForGap(
    voices: AccompanyVoice[],
    fromWhole: number,
    toWhole: number,
    isFirst: boolean,
    bpm: number,
): ScheduledVoice[] {
    // A non-positive tempo would divide by zero; the caller clamps the live tempo,
    // but guard so a stray value can't schedule notes at infinity.
    const msPerQuarter = 60000 / Math.max(bpm, 1);
    const eps = 1e-6;
    const scheduled: ScheduledVoice[] = [];
    for (const voice of voices) {
        const belowTop = voice.whole < toWhole - eps;
        // The first gap reaches back before your first note to catch a pickup; every
        // later gap starts at the note you just cleared.
        const aboveBottom = isFirst || voice.whole >= fromWhole - eps;
        if (!belowTop || !aboveBottom) {
            continue;
        }
        const delayMs = Math.max(0, voice.whole - fromWhole) * 4 * msPerQuarter;
        scheduled.push({
            pitch: voice.pitch,
            delayMs,
            // A note the score marks with no length still needs an audible tail; fall
            // back to a quarter so it sounds like a played note, not a click.
            durationSec: (voice.quarters || 1) * (msPerQuarter / 1000),
        });
    }
    return scheduled;
}
