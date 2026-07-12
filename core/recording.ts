// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { RecordedNote } from "./composition";

// The live-capture state machine behind the compose page: notes press in and
// release out against a clock origin, and the completed list stays sorted by
// onset. Every transition returns a new state, so the capture logic is testable
// without a keyboard attached.

export type OpenNote = { startMs: number; velocity: number };

export type RecordingState = {
    // The wall-clock instant (in the event timestamp domain) that maps to the
    // recording's zero; null until the first note anchors it, and re-anchored
    // after a clear/truncate so new notes append after the kept tail.
    originMs: number | null;
    // Held-down notes keyed by pitch, waiting for their release.
    open: ReadonlyMap<number, OpenNote>;
    notes: readonly RecordedNote[];
};

export const EMPTY_RECORDING: RecordingState = {
    originMs: null,
    open: new Map(),
    notes: [],
};

// The end of the recorded timeline in milliseconds — the moment the last-released
// note stops sounding. New notes append after it, so a loaded share keeps growing.
export function tailMs(notes: readonly RecordedNote[]): number {
    return notes.reduce((end, note) => Math.max(end, note.startMs + note.durationMs), 0);
}

// A key press: anchors the clock on the first note (so a freshly loaded share's
// new notes land after its tail) and holds the note open until its release.
export function noteOn(
    state: RecordingState,
    event: { note: number; velocity: number; timestamp: number },
): RecordingState {
    const originMs = state.originMs ?? event.timestamp - tailMs(state.notes);
    const open = new Map(state.open);
    open.set(event.note, {
        startMs: event.timestamp - originMs,
        velocity: event.velocity || 90,
    });
    return { ...state, originMs, open };
}

// A key release completes its open note. Notes complete in release order, so the
// list is kept sorted by onset — the codec and the staff both assume ascending
// starts. A release with no matching press (or before any anchor) is ignored.
export function noteOff(
    state: RecordingState,
    event: { note: number; timestamp: number },
): RecordingState {
    const held = state.open.get(event.note);
    if (!held || state.originMs === null) {
        return state;
    }
    const open = new Map(state.open);
    open.delete(event.note);
    const recorded: RecordedNote = {
        pitch: event.note,
        startMs: held.startMs,
        durationMs: Math.max(1, event.timestamp - state.originMs - held.startMs),
        velocity: held.velocity,
    };
    const notes = [...state.notes, recorded].sort((a, b) => a.startMs - b.startMs);
    return { ...state, open, notes };
}

// Keep only the first `count` notes (a checkpoint rewind). The clock re-anchors
// on the next note so the tail picks up after the kept part.
export function truncatedTo(state: RecordingState, count: number): RecordingState {
    return { originMs: null, open: new Map(), notes: state.notes.slice(0, count) };
}

// Swap the take over to loaded notes (a share link or an opened file), with the
// clock unanchored so the next played note appends after the loaded tail.
export function withNotes(notes: readonly RecordedNote[]): RecordingState {
    return { originMs: null, open: new Map(), notes };
}

// Anchor the recording's zero to a known instant — the downbeat after a count-in
// — so what's played next sits on the metronome's grid, appending after the tail.
export function anchoredAt(state: RecordingState, nowMs: number): RecordingState {
    return { ...state, originMs: nowMs - tailMs(state.notes), open: new Map() };
}
