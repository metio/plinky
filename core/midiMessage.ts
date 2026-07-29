// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The two MIDI messages the app ever sends. Echoing what Plinky plays to a
// connected instrument lights its keys, so a player can watch a piece move under
// their hands rather than only hear it.
//
// Sending is decoration: an instrument that ignores it, or is not there at all,
// changes nothing about the run.

// Channel 1, which is what a keyboard listens on unless told otherwise.
const CHANNEL = 0;
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

export function noteOn(note: number, velocity = 64): number[] {
    return [NOTE_ON | CHANNEL, note, clampVelocity(velocity)];
}

// Velocity zero on a note-off is the convention every device understands, and some
// only understand.
export function noteOff(note: number): number[] {
    return [NOTE_OFF | CHANNEL, note, 0];
}
