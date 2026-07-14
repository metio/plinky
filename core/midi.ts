// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The Web MIDI API types ship in TypeScript's DOM lib. At runtime, though, only
// Chromium browsers and Firefox expose `requestMIDIAccess`; Safari (macOS and
// iOS) does not, which is why `support` can settle on "unsupported" even though
// the type system treats the entry point as always present.

import { DEFAULT_KEY_MAP, type KeyMap } from "./keyMap";
import type { PedalKind } from "./pedals";

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

// The MIDI control-change number each pedal speaks on: sustain 64, sostenuto 66, soft 67.
const PEDAL_CC: Record<number, PedalKind> = { 64: "sustain", 66: "sostenuto", 67: "soft" };

// A decoded MIDI message the app acts on: a note-on/off, or one of the three pedals
// changing. Every other message (expression, bank select, pitch bend…) decodes to
// null and is ignored.
export type ParsedMessage =
    | { kind: "noteon" | "noteoff"; note: number; velocity: number; channel: number }
    | { kind: "pedal"; pedal: PedalKind; down: boolean; channel: number };

// Decode a raw MIDI status/data triple into a note event or a pedal change, or null
// for anything else. A note-on with zero velocity is the conventional "running status"
// way to release a key, so it reads as note-off. A pedal control change reads as down
// when its value is in the upper half (≥64), the MIDI convention.
export function parseMidiMessage(data: Uint8Array | null): ParsedMessage | null {
    if (!data || data.length < 2) {
        return null;
    }
    const type = data[0]! & 0xf0;
    const channel = (data[0]! & 0x0f) + 1;

    if (type === 0xb0) {
        // Control change. Only the three pedals are acted on; every other controller
        // (expression, modulation, bank select…) is ignored.
        const pedal = PEDAL_CC[data[1]!];
        if (!pedal) {
            return null;
        }
        return { kind: "pedal", pedal, down: (data.length > 2 ? data[2]! : 0) >= 64, channel };
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

// A tap on the on-screen keys or a jab at a computer key is far shorter than a real key
// press, so a note played that way rings clipped. The live voice for those inputs is let
// ring as if the key had been held this much longer — enough to sound musical without
// droning — so someone playing on an iPad with no piano still makes a note that sings. A
// real MIDI key (and the microphone, which opens no live voice) is untouched at 1.
export const IMPRECISE_HOLD_SCALE = 1.8;

// The generous ring for imprecise input, or 1 (no change) for a real instrument. Mic
// input opens no live voice, so it never reaches here; the two fallback keyboards do.
export function holdScaleFor(device: string): number {
    return device === ON_SCREEN_DEVICE || device === KEYBOARD_DEVICE ? IMPRECISE_HOLD_SCALE : 1;
}
export const MIN_OCTAVE_OFFSET = -3;
export const MAX_OCTAVE_OFFSET = 3;

const LEFT_HAND_BASE_NOTE = 60; // C4 at octave offset 0
const RIGHT_HAND_BASE_NOTE = 72; // C5 — one octave above the left hand

// Map a pressed key to its MIDI note for the active octave offset, or null when the
// key is not part of the layout. The two-row virtual-piano split (a full octave per
// hand) is the default, but a player can rebind keys (see keyMap), so the live
// mapping is passed in.
// The top of an 88-key piano (C8); notes above it are off the instrument and must not
// sound. A0 (21) is the bottom, but the layout never reaches below it.
const MAX_PIANO_NOTE = 108;

export function keyToNote(
    key: string,
    octaveOffset: number,
    keyMap: KeyMap = DEFAULT_KEY_MAP,
): number | null {
    // Lower-case to match how the map is keyed, so a key arriving upper-cased (Shift, or
    // a platform that reports the shifted glyph) still resolves — as pedalForKey does.
    const lower = key.toLowerCase();
    let note: number | null = null;
    if (lower in keyMap.left) {
        note = LEFT_HAND_BASE_NOTE + octaveOffset * 12 + keyMap.left[lower]!;
    } else if (lower in keyMap.right) {
        note = RIGHT_HAND_BASE_NOTE + octaveOffset * 12 + keyMap.right[lower]!;
    }
    // A high octave offset can push the top row past the keyboard; drop phantom notes
    // rather than sound pitches no piano has.
    if (note === null || note < 0 || note > MAX_PIANO_NOTE) {
        return null;
    }
    return note;
}
