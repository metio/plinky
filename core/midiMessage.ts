// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The two MIDI messages the app ever sends. Echoing what Plinky plays to a connected
// instrument makes a sound module play along, so a piece can be heard on the
// instrument's own voice rather than the browser's.
//
// Sending is decoration: an instrument that ignores it, or is not there at all,
// changes nothing about the run.

// Channel 1, which is what a sound module listens on unless told otherwise.
export const DEFAULT_CHANNEL = 1;

// Where to send, avoiding a channel that is lighting keys.
//
// A lighted keyboard reads note messages on its two navigation channels and turns them
// into lights, so an echo landing on one of those makes keys glow for notes the player
// is not being asked to play — and a lighting note-off silences a note the echo is
// still sounding. The two features are about different things (one drives a sound
// module, the other drives lights), so the echo steps aside rather than making the
// player work out the clash.
//
// The step is deliberately small and upward: sound modules are most often listening
// low, and moving to 16 would lose a single-timbre module set to channel 1 entirely.
export function echoChannel(avoid: readonly number[]): number {
    for (let channel = DEFAULT_CHANNEL; channel <= 16; channel++) {
        if (!avoid.includes(channel)) {
            return channel;
        }
    }
    return DEFAULT_CHANNEL;
}
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

// MIDI carries seven-bit values, so anything outside 0–127 is not sendable. A note
// off the keyboard is dropped rather than wrapped, which would light a key an
// octave away from the one meant.
export function sendable(note: number): boolean {
    return Number.isInteger(note) && note >= 0 && note <= 127;
}

function clampVelocity(velocity: number): number {
    if (!Number.isFinite(velocity)) {
        return 64;
    }
    return Math.min(127, Math.max(1, Math.round(velocity)));
}

export function noteOn(note: number, velocity = 64, channel = DEFAULT_CHANNEL): number[] {
    return [NOTE_ON | ((channel - 1) & 0x0f), note, clampVelocity(velocity)];
}

// Velocity zero on a note-off is the convention every device understands, and some
// only understand.
export function noteOff(note: number, channel = DEFAULT_CHANNEL): number[] {
    return [NOTE_OFF | ((channel - 1) & 0x0f), note, 0];
}
