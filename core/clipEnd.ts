// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where to end a short clip of a piece, so it stops where the music does.
//
// A fixed twenty seconds cuts wherever twenty seconds happens to fall — mid-phrase, mid
// chord, on a note that has only just started. What a listener hears as an ending is a
// silence: the moment every sounding note has been released and the next has not begun.
// Every piece has several in half a minute, and the widest of them is the one that reads
// as a breath rather than as a stumble.
//
// So the caller asks for a window and a length to aim at, and this finds the silence
// closest to it. Nearest rather than widest, because the point is a batch of clips that
// average where they were asked to: always taking the widest pause pulls every clip toward
// whichever end of the window happens to hold the biggest breath. Pure, and given only what
// a performance already knows: when each note starts and how long it sounds.

// The shape of a RecordedNote, narrowed to what a cut needs.
export type ClipNote = { startMs: number; durationMs: number };

// How wide a silence has to be before it reads as a pause rather than as articulation.
// A staccato gap is tens of milliseconds; a breath between phrases is a beat or more.
export const PAUSE_MS = 220;

// What a second of mistiming is worth, in milliseconds of silence. This is the whole trade
// between stopping somewhere good and stopping at the right time: a fifth-of-a-second
// breath two seconds early beats a hairline gap exactly on the mark, and a hairline gap on
// the mark beats another one four seconds early. A piece that genuinely ends inside the
// window is unaffected — nothing outscores an ending.
export const TIMING_COST_MS = 30;

// Silence to leave after the last note so the clip does not stop the instant it is
// released. Shorter than the tail on a full-length render: this is a cut, not an ending.
export const RING_MS = 450;

// Silence after the last note of a whole piece. Longer than a cut's ring-out: this one is
// the end of the music rather than a place the music was stopped, and an ending wants the
// room to be heard as one.
export const ENDING_MS = 700;

export type ClipEnd = {
    // Where to stop, in ms on the notes' own clock.
    endMs: number;
    // The silence that decided it, if one did. Absent when the window held no pause and
    // the clip is cut at its latest bound.
    pauseMs?: number;
};

// How far past the window a performance has to be read before it is cut. Without it the
// reading stops exactly at the window's far edge, and the cut cannot tell a piece that
// ended there from one that was merely not read any further.
export const LOOKAHEAD_MS = 6_000;

export type ClipWindow = {
    earliestMs: number;
    latestMs: number;
    // What the batch should average. The pause nearest this wins.
    targetMs: number;
};

// The end of a clip that starts at 0 and should last somewhere inside the window, at the
// pause nearest the target.
//
// Notes that begin after the chosen end are the caller's to drop; a note still sounding at
// it cannot happen, because a cut is only ever made where nothing is sounding.
export function clipEnd(notes: readonly ClipNote[], window: ClipWindow): ClipEnd {
    const { earliestMs, latestMs, targetMs } = window;
    if (notes.length === 0 || !(latestMs > earliestMs)) {
        return { endMs: latestMs };
    }
    const candidates = gapsIn(notes, window);
    // The piece running out inside the window is a silence nothing follows, and the best
    // ending there is. It only counts when the music really ended: a performance read only
    // as far as the window stops at the window, and treating that as an ending would hand
    // every continuous piece a perfect cut at the far edge. Reading past the window
    // (LOOKAHEAD_MS) is what makes the two distinguishable.
    const whole = lengthOf(notes);
    if (whole >= earliestMs && whole <= latestMs) {
        candidates.push({ atMs: whole, gapMs: Number.POSITIVE_INFINITY });
    }
    const best = widestNearTarget(candidates, targetMs);
    return best === null ? { endMs: latestMs } : { endMs: best.atMs, pauseMs: best.gapMs };
}

// The best silence to stop in: the widest one, discounted by how far it lands from the
// length the batch is aiming at.
//
// Both halves have to be in the same sentence, because taking either alone gets it wrong.
// Always the widest drags every clip to whichever end of the window happens to hold the
// biggest breath, and the batch stops averaging where it was asked to. Always the nearest
// ignores width entirely — and in legato writing there is a hairline gap between almost
// every pair of notes, so the cut lands on whichever six-millisecond hole sits closest to
// the mark and the clip stops in the middle of a running passage.
function widestNearTarget(candidates: readonly Gap[], targetMs: number): Gap | null {
    let best: Gap | null = null;
    let top = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
        const secondsOff = Math.abs(candidate.atMs - targetMs) / 1_000;
        const score = candidate.gapMs - secondsOff * TIMING_COST_MS;
        if (score > top) {
            top = score;
            best = candidate;
        }
    }
    return best;
}

// Every silence inside the window, in the order the music makes them. Diagnostics: what
// `clipEnd` had to choose among, so a batch of clips that ends in the wrong places can be
// read rather than guessed at.
export function gapsIn(notes: readonly ClipNote[], window: ClipWindow): Gap[] {
    const found: Gap[] = [];
    let sounding = 0;
    for (const note of [...notes].sort((a, b) => a.startMs - b.startMs)) {
        const gap = note.startMs - sounding;
        if (gap > 0 && sounding >= window.earliestMs && sounding <= window.latestMs) {
            found.push({ atMs: sounding, gapMs: gap });
        }
        sounding = Math.max(sounding, note.startMs + Math.max(0, note.durationMs));
    }
    return found;
}

export type Gap = { atMs: number; gapMs: number };

function lengthOf(notes: readonly ClipNote[]): number {
    let end = 0;
    for (const note of notes) {
        end = Math.max(end, note.startMs + Math.max(0, note.durationMs));
    }
    return end;
}

export type ClipCut<T extends ClipNote> = ClipEnd & {
    // The notes to render: everything that starts before the cut. A fresh array — the
    // caller owns it.
    notes: T[];
    // How long the video runs, ring-out included.
    durationMs: number;
};

// The whole cut in one place: which notes a clip keeps and how long it runs.
//
// One definition, because two is how the lengths drifted. The renderer used to keep the
// notes itself and run to the end of the last one still sounding, while the length
// function here — the one under test — computed something else entirely and was called by
// nothing. A window of null is a full-length upload: the whole piece, no cut.
export function clipCut<T extends ClipNote>(
    notes: readonly T[],
    window: ClipWindow | null,
): ClipCut<T> {
    if (window === null) {
        const whole = lengthOf(notes);
        return { endMs: whole, notes: [...notes], durationMs: Math.round(whole + ENDING_MS) };
    }
    const end = clipEnd(notes, window);
    const kept = notes.filter((note) => note.startMs < end.endMs);
    // A chosen pause is a moment nothing is sounding, so the kept notes end exactly there.
    // A bounded cut is not: with no silence anywhere in the window, a note struck before
    // the far edge is still ringing at it, and letting the clip run on with that note is
    // how a thirty-second window produced thirty-five seconds of video.
    const stops = Math.min(lengthOf(kept), window.latestMs);
    // A clip that ends because the piece ended is an ending, and gets an ending's room.
    const tail = end.pauseMs === Number.POSITIVE_INFINITY ? ENDING_MS : RING_MS;
    return { ...end, notes: kept, durationMs: Math.round(stops + tail) };
}

// The window the promo clips use: somewhere between twenty and thirty seconds, aiming at
// twenty-five, so a feed of them averages where it was asked to.
export const PROMO_WINDOW: ClipWindow = {
    earliestMs: 20_000,
    latestMs: 30_000,
    targetMs: 25_000,
};
