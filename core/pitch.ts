// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The semitone offset of each natural note letter above C — the shared base every
// MusicXML reader adds <octave> and <alter> to when turning a written pitch into a
// MIDI number. One definition so the parsers can't drift apart.
export const STEP_SEMITONES: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};

// MIDI note 69 is A4 = 440 Hz; every semitone is a factor of 2^(1/12).
export function midiToFrequency(note: number): number {
    return 440 * 2 ** ((note - 69) / 12);
}
