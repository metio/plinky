// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The Web MIDI API types ship in TypeScript's DOM lib. At runtime, though, only
// Chromium browsers and Firefox expose `requestMIDIAccess`; Safari (macOS and
// iOS) does not, which is why `support` can settle on "unsupported" even though
// the type system treats the entry point as always present.

export type MidiSupport = "unknown" | "unsupported" | "supported";

export type MidiStatus = "idle" | "requesting" | "ready" | "denied" | "error";

export type MidiDevice = {
    id: string;
    name: string;
    manufacturer: string;
    state: "connected" | "disconnected";
};

export type MidiNoteEvent = {
    id: number;
    kind: "noteon" | "noteoff";
    note: number;
    noteName: string;
    velocity: number;
    channel: number;
    device: string;
    timestamp: number;
};

export const MAX_EVENTS = 100;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// MIDI note 60 is middle C (C4), so the octave is offset by one below the raw
// division by twelve.
export function noteName(note: number): string {
    return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

export type ParsedMessage = {
    kind: MidiNoteEvent["kind"];
    note: number;
    velocity: number;
    channel: number;
};

// Decode a raw MIDI status/data triple into a note event, or null for messages
// that are neither note-on nor note-off. A note-on with zero velocity is the
// conventional "running status" way to release a key, so it reads as note-off.
export function parseMidiMessage(data: Uint8Array | null): ParsedMessage | null {
    if (!data || data.length < 2) {
        return null;
    }
    const type = data[0] & 0xf0;
    const channel = (data[0] & 0x0f) + 1;
    const note = data[1];
    const velocity = data.length > 2 ? data[2] : 0;

    const isNoteOn = type === 0x90 && velocity > 0;
    const isNoteOff = type === 0x80 || (type === 0x90 && velocity === 0);
    if (!isNoteOn && !isNoteOff) {
        return null;
    }
    return { kind: isNoteOn ? "noteon" : "noteoff", note, velocity, channel };
}

// Five-finger home-row split so both hands rest naturally: the left hand plays
// C–G on the home row (A S D F G), the right hand the same five notes an octave
// up on H J K L ;, with each span's three black keys (C♯ D♯ F♯) on the row above
// (W E T and U I P). Values are semitone offsets from each hand's base C; the
// other top-row keys produce no note, as on a real keyboard.
const LEFT_HAND_KEYS: Record<string, number> = {
    a: 0,
    w: 1,
    s: 2,
    e: 3,
    d: 4,
    f: 5,
    t: 6,
    g: 7,
};
const RIGHT_HAND_KEYS: Record<string, number> = {
    h: 0,
    u: 1,
    j: 2,
    i: 3,
    k: 4,
    l: 5,
    p: 6,
    ";": 7,
};

export const KEYBOARD_DEVICE = "Computer keyboard";
export const KEYBOARD_VELOCITY = 80;
export const MIN_OCTAVE_OFFSET = -3;
export const MAX_OCTAVE_OFFSET = 3;

const LEFT_HAND_BASE_NOTE = 60; // C4 at octave offset 0
const RIGHT_HAND_BASE_NOTE = 72; // C5 — one octave above the left hand

// Map a pressed key to its MIDI note for the active octave offset, or null when
// the key is not part of the layout.
export function keyToNote(key: string, octaveOffset: number): number | null {
    if (key in LEFT_HAND_KEYS) {
        return LEFT_HAND_BASE_NOTE + octaveOffset * 12 + LEFT_HAND_KEYS[key];
    }
    if (key in RIGHT_HAND_KEYS) {
        return RIGHT_HAND_BASE_NOTE + octaveOffset * 12 + RIGHT_HAND_KEYS[key];
    }
    return null;
}
