// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The three piano pedals. Sustain (the damper) holds released notes ringing; sostenuto
// holds only the notes already down when it is pressed; soft (una corda) gentles the
// tone. Lives in its own module so both the MIDI decoder and the keyboard layout — which
// lets a computer-keyboard player bind a key to each — can name them without a cycle.
export type PedalKind = "sustain" | "sostenuto" | "soft";

export const PEDAL_KINDS: PedalKind[] = ["sustain", "sostenuto", "soft"];
