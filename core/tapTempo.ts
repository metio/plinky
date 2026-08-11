// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a tempo from someone tapping along. A player who knows how fast a piece
// should go usually cannot say the number — they can only tap it, which is what a
// teacher asks for and what this turns into a figure the metronome can take.

// The tempo band the rest of the app works in, so a reading can be handed straight to
// the metronome without a second clamp.
export const MIN_BPM = 20;
export const MAX_BPM = 300;

// Taps further apart than this start a new measurement rather than dragging the old
// one down: a pause means the person stopped, not that they slowed to four beats a
// minute.
export const RESET_AFTER_MS = 3000;

// How many recent gaps the reading averages over. Enough to steady a human hand,
// short enough that speeding up shows within a couple of beats.
const WINDOW = 6;

export type TapState = {
    // The most recent tap times, newest last. Bounded by the window plus the tap that
    // opened it.
    taps: number[];
};

export const NO_TAPS: TapState = { taps: [] };

export function tap(state: TapState, atMs: number): TapState {
    const last = state.taps.at(-1);
    // A tap that arrives before the previous one — a clock corrected mid-tap — would
    // otherwise contribute a negative gap and drag the average below zero.
    if (last !== undefined && (atMs - last > RESET_AFTER_MS || atMs < last)) {
        return { taps: [atMs] };
    }
    return { taps: [...state.taps, atMs].slice(-(WINDOW + 1)) };
}

// The tempo those taps describe, or null before there are two of them — one tap
// marks a moment and says nothing about a speed.
export function bpmOf(state: TapState): number | null {
    if (state.taps.length < 2) {
        return null;
    }
    const gaps: number[] = [];
    for (let index = 1; index < state.taps.length; index++) {
        gaps.push((state.taps[index] as number) - (state.taps[index - 1] as number));
    }
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (mean <= 0) {
        return null;
    }
    const bpm = Math.round(60_000 / mean);
    return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

// How many taps have gone into the current reading, so the display can say it is
// still settling rather than presenting two taps as a measurement.
export function tapCount(state: TapState): number {
    return state.taps.length;
}
