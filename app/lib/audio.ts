// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A single AudioContext shared by the metronome and the note synth. Browsers
// limit how many contexts a page may open, and one context keeps the metronome
// click and synthesized notes on the same clock.
let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") {
        return null;
    }
    if (!sharedContext) {
        sharedContext = new AudioContext();
    }
    return sharedContext;
}

// MIDI note 69 is A4 = 440 Hz; every semitone is a factor of 2^(1/12).
export function midiToFrequency(note: number): number {
    return 440 * 2 ** ((note - 69) / 12);
}
