// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The pure half of exporting a take as a video: sampling a recorded performance
// into per-frame states a renderer can draw. A frame knows which keys are
// sounding at its instant, which note the cursor is on, and how far through the
// take it is — everything visual; rasterizing and encoding live behind
// adapters. Deterministic by construction: the same take at the same fps always
// yields the same frames.

import type { RecordedNote } from "./composition";

export type FrameState = {
    // This frame's instant, in ms from the take's first note.
    timeMs: number;
    // The keys sounding at this instant, for the on-screen keyboard; heldMs is
    // how long each note has been sounding, so a renderer can let the press
    // visibly decay and re-light on a repeat.
    down: { pitch: number; velocity: number; heldMs: number }[];
    // The onset (ms on the notes' clock) of the latest note started by this
    // instant — the cursor's chord — or null before the first onset. An onset
    // rather than an index, so the state is independent of the note list's
    // order and only ever moves forward.
    currentOnsetMs: number | null;
    // Notes whose onset has passed, out of all notes: the progress readout.
    done: number;
    total: number;
};

// Breathing room around the performance: a beat of stillness before the first
// note so the video doesn't open mid-sound, and a tail long enough for the last
// note to ring out and the final frame to rest.
export const LEAD_IN_MS = 1_000;
export const TAIL_MS = 1_500;

// The whole video's span: lead-in, first-to-last sounding note, tail. A take
// always has notes (an empty run is never saved), but an empty list still maps
// to just the framing so callers need no special case.
export function videoDurationMs(notes: RecordedNote[]): number {
    const end = notes.reduce((max, note) => Math.max(max, note.startMs + note.durationMs), 0);
    return LEAD_IN_MS + end + TAIL_MS;
}

// The frame instants for the take at the given rate — the timestamps the
// encoder will stamp onto the stream, so they come from frame arithmetic (index
// over fps), never from accumulating floats.
export function frameTimesMs(durationMs: number, fps: number): number[] {
    // Multiply before dividing: durationMs and fps are integers, so the frame
    // count is exact. Dividing first can round a whole-frame duration up and
    // put a spurious frame at (or past) the video's end.
    const count = Math.ceil((durationMs * fps) / 1000);
    return Array.from({ length: count }, (_, index) => (index * 1000) / fps);
}

// How brightly a sounding key glows, given how long its note has been held:
// full at the press, easing linearly to a floor over the fade — never to
// nothing, so a long-held note still reads as down. The snap back to full on
// the next onset is what makes a repeated press of the same key visible.
export const PRESS_FADE_MS = 1_500;
const PRESS_GLOW_FLOOR = 0.35;

export function pressGlow(heldMs: number): number {
    return Math.max(PRESS_GLOW_FLOOR, Math.min(1, 1 - heldMs / PRESS_FADE_MS));
}

// Sample the take at one instant. timeMs is on the video clock (0 = start of
// the lead-in); the notes' own clock starts LEAD_IN_MS later.
export function frameAt(notes: RecordedNote[], timeMs: number): FrameState {
    const t = timeMs - LEAD_IN_MS;
    const down = notes
        .filter((note) => note.startMs <= t && t < note.startMs + note.durationMs)
        .map((note) => ({ pitch: note.pitch, velocity: note.velocity, heldMs: t - note.startMs }));
    let currentOnsetMs: number | null = null;
    let done = 0;
    for (const note of notes) {
        if (note.startMs <= t) {
            done++;
            if (currentOnsetMs === null || note.startMs > currentOnsetMs) {
                currentOnsetMs = note.startMs;
            }
        }
    }
    return { timeMs, down, currentOnsetMs, done, total: notes.length };
}
