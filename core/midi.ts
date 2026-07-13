// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The Web MIDI API types ship in TypeScript's DOM lib. At runtime, though, only
// Chromium browsers and Firefox expose `requestMIDIAccess`; Safari (macOS and
// iOS) does not, which is why `support` can settle on "unsupported" even though
// the type system treats the entry point as always present.

import { DEFAULT_KEY_MAP, type KeyMap } from "./keyMap";

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
// division by twelve. The pitch class is taken with a floor-mod so a note below
// MIDI 0 still names a real letter rather than indexing off the end of the array.
export function noteName(note: number): string {
    return `${NOTE_NAMES[((note % 12) + 12) % 12]!}${Math.floor(note / 12) - 1}`;
}

// The note's letter alone (no octave), with a typographic sharp — what a beginner
// reads off a labelled key to learn where the notes are. The pitch class is taken
// modulo 12 with a floor-mod so a note below MIDI 0 still maps cleanly.
const PITCH_CLASSES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export function pitchClass(note: number): string {
    return PITCH_CLASSES[((note % 12) + 12) % 12]!;
}

// The MIDI controller number of the sustain (damper) pedal — Control Change 64.
export const SUSTAIN_PEDAL_CC = 64;

// A decoded MIDI message the app acts on: a note-on/off, or a sustain-pedal change.
// Every other message (other control changes, pitch bend, aftertouch…) decodes to
// null and is ignored.
export type ParsedMessage =
    | { kind: "noteon" | "noteoff"; note: number; velocity: number; channel: number }
    | { kind: "pedal"; down: boolean; channel: number };

// Decode a raw MIDI status/data triple into a note event or a pedal change, or null
// for anything else. A note-on with zero velocity is the conventional "running status"
// way to release a key, so it reads as note-off. A sustain-pedal control change reads
// as down when its value is in the upper half (≥64), the MIDI convention.
export function parseMidiMessage(data: Uint8Array | null): ParsedMessage | null {
    if (!data || data.length < 2) {
        return null;
    }
    const type = data[0]! & 0xf0;
    const channel = (data[0]! & 0x0f) + 1;

    if (type === 0xb0) {
        // Control change. Only the sustain pedal is acted on; every other controller
        // (soft pedal, expression, bank select…) is ignored.
        if (data[1]! !== SUSTAIN_PEDAL_CC) {
            return null;
        }
        return { kind: "pedal", down: (data.length > 2 ? data[2]! : 0) >= 64, channel };
    }

    const note = data[1]!;
    const velocity = data.length > 2 ? data[2]! : 0;
    const isNoteOn = type === 0x90 && velocity > 0;
    const isNoteOff = type === 0x80 || (type === 0x90 && velocity === 0);
    if (!isNoteOn && !isNoteOff) {
        return null;
    }
    return { kind: isNoteOn ? "noteon" : "noteoff", note, velocity, channel };
}

export const KEYBOARD_DEVICE = "Computer keyboard";
export const ON_SCREEN_DEVICE = "On-screen keyboard";
export const MIC_DEVICE = "Microphone";
export const KEYBOARD_VELOCITY = 80;

// Whether an input source carries true velocity and rhythm. The on-screen and
// computer-keyboard fallbacks send a fixed velocity and can't tap a precise beat,
// and microphone pitch detection adds its own latency and wobble on top — so runs
// played on any of them are timed with widened windows; a real MIDI instrument
// (any other device name) is held to the tight ones.
export function isPreciseInput(device: string): boolean {
    return device !== ON_SCREEN_DEVICE && device !== KEYBOARD_DEVICE && device !== MIC_DEVICE;
}
export const MIN_OCTAVE_OFFSET = -3;
export const MAX_OCTAVE_OFFSET = 3;

const LEFT_HAND_BASE_NOTE = 60; // C4 at octave offset 0
const RIGHT_HAND_BASE_NOTE = 72; // C5 — one octave above the left hand

// Map a pressed key to its MIDI note for the active octave offset, or null when the
// key is not part of the layout. The two-row virtual-piano split (a full octave per
// hand) is the default, but a player can rebind keys (see keyMap), so the live
// mapping is passed in.
export function keyToNote(
    key: string,
    octaveOffset: number,
    keyMap: KeyMap = DEFAULT_KEY_MAP,
): number | null {
    if (key in keyMap.left) {
        return LEFT_HAND_BASE_NOTE + octaveOffset * 12 + keyMap.left[key]!;
    }
    if (key in keyMap.right) {
        return RIGHT_HAND_BASE_NOTE + octaveOffset * 12 + keyMap.right[key]!;
    }
    return null;
}
