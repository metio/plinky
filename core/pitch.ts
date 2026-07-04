// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// MIDI note 69 is A4 = 440 Hz; every semitone is a factor of 2^(1/12).
export function midiToFrequency(note: number): number {
    return 440 * 2 ** ((note - 69) / 12);
}
