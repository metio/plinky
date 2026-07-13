// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The run recorder: everything a practice run captures as it is played — each
// cleared note's ideal and actual timing, the velocities, the real key-hold
// lengths as MIDI releases land, and whether any input was imprecise. The play
// surface feeds matcher clears and note-offs in; the grade, the share grid, the
// saved take and the ghost are all derived from the finished capture.
//
// The capture is a single mutable record (like the ActiveHolds map it embeds):
// the matcher callback and the MIDI release handler both advance it between
// renders, so the surface holds one instance in a ref and the functions here
// mutate it in place.

import type { OutcomeNote } from "./runOutcome";
import { type ActiveHolds, beginHold, endHold } from "./takes";
import { instantaneousBpm } from "./tempo";

// A cleared note plus the pitches sounded at that step — the run's raw record.
// heldMs is the real key-hold length, filled in from the MIDI note-off once the
// key is released (absent for imprecise input, which reports no meaningful hold).
export type CapturedNote = OutcomeNote & { pitches: number[]; heldMs?: number };

export type RunCapture = {
    notes: CapturedNote[];
    // Each still-held pitch mapped to the note it belongs to, so its release can
    // record how long the key was held.
    holds: ActiveHolds;
    // Whether the sustain pedal is currently down, so a key released under it keeps
    // sounding — the damper model, so a recorded (and replayed) take reflects the pedal.
    pedalDown: boolean;
    // Pitches whose key has lifted but which are still sounding because the pedal is
    // down; their hold stays open until the pedal lifts or the note is re-struck.
    pedalHeld: Set<number>;
    // Wall-clock of the run's first cleared note — the run clock's zero, and the
    // ghost race's starting gun. 0 until that note lands.
    startedAt: number;
    // The first note's notated onset, subtracted so targetMs counts from note one.
    baseOffsetMs: number;
    // Whether any note came from an imprecise input (on-screen or computer
    // keyboard), which grades with widened timing windows.
    imprecise: boolean;
};

export function startCapture(): RunCapture {
    return {
        notes: [],
        holds: new Map(),
        pedalDown: false,
        pedalHeld: new Set(),
        startedAt: 0,
        baseOffsetMs: 0,
        imprecise: false,
    };
}

// Close a still-open hold at `atMs`, recording its length onto the note it belongs
// to — keeping the longest when a chord's pitches close separately. A stray pitch
// (never opened) records nothing.
function closeHold(capture: RunCapture, pitch: number, atMs: number): void {
    const released = endHold(capture.holds, pitch, atMs);
    if (!released) {
        return;
    }
    const note = capture.notes[released.index];
    if (note) {
        note.heldMs = Math.max(note.heldMs ?? 0, released.heldMs);
    }
}

// What the matcher reports for a cleared position — the structural subset of the
// hook's CorrectInfo the capture needs.
export type ClearedNote = {
    pitches: number[];
    ordinal: number;
    // Wall-clock when it was played, and its notated onset in ms at the run tempo.
    timestamp: number;
    timeMs: number;
    velocity: number;
    wrongBefore: number;
    staves: number[];
};

// Record a cleared position: the first one seeds the run clock, every one appends
// its ideal-vs-actual timing and opens a hold per pitch for the release to close.
export function captureCleared(capture: RunCapture, info: ClearedNote): void {
    if (info.ordinal === 0) {
        capture.startedAt = info.timestamp;
        capture.baseOffsetMs = info.timeMs;
    }
    capture.notes.push({
        targetMs: info.timeMs - capture.baseOffsetMs,
        playedMs: info.timestamp - capture.startedAt,
        wrongBefore: info.wrongBefore,
        velocity: info.velocity,
        pitches: [...info.pitches],
        staves: info.staves,
    });
    const index = capture.notes.length - 1;
    for (const pitch of info.pitches) {
        // Re-striking a pitch the pedal was still holding ends that earlier instance
        // here — its ring lasted until this re-strike — before the new hold opens.
        if (capture.pedalHeld.delete(pitch)) {
            closeHold(capture, pitch, info.timestamp);
        }
        beginHold(capture.holds, pitch, index, info.timestamp);
    }
}

// A released key fills in its note's real hold length. A chord's pitches release
// one by one; the longest is kept so the note's recorded length is how long the
// chord actually rang. A stray release (untracked pitch) records nothing. While the
// sustain pedal is down the key release doesn't end the note — the damper is up, so it
// rings on; its hold is left open and marked pedal-held until the pedal lifts.
export function captureRelease(capture: RunCapture, pitch: number, offMs: number): void {
    if (capture.pedalDown && capture.holds.has(pitch)) {
        capture.pedalHeld.add(pitch);
        return;
    }
    closeHold(capture, pitch, offMs);
}

// The sustain pedal changed. Pressing it arms the damper; lifting it drops every note
// still ringing only because the pedal held it, ending each hold at the lift — so a
// pedalled note's recorded length runs through to the pedal release, and the take
// replays the way it was played.
export function capturePedal(capture: RunCapture, down: boolean, atMs: number): void {
    capture.pedalDown = down;
    if (down) {
        return;
    }
    for (const pitch of capture.pedalHeld) {
        closeHold(capture, pitch, atMs);
    }
    capture.pedalHeld.clear();
}

// Close every still-open hold at `atMs` — the run has ended, so a key still down (the
// final note held to the last beat) or a note still ringing under the pedal must record
// its real length now, not fall back to a bare beat. Idempotent: a second call finds
// nothing open. Call this before deriving the take from the capture.
export function flushHolds(capture: RunCapture, atMs: number): void {
    for (const pitch of [...capture.holds.keys()]) {
        closeHold(capture, pitch, atMs);
    }
    capture.pedalHeld.clear();
}

// The adaptive metronome's next tempo: read the player's pace from the gap
// between the last two notes and ease the shown tempo toward it, so a single
// rushed note nudges rather than jerks the pulse. Clamped to the tempo slider's
// own range; `previous` unchanged until two notes exist or when the gap gives no
// usable estimate (a chord's zero gap, a rewound clock).
export function liveTempo(capture: RunCapture, runTempo: number, previous: number): number {
    const a = capture.notes[capture.notes.length - 2];
    const b = capture.notes[capture.notes.length - 1];
    if (!a || !b) {
        return previous;
    }
    const instant = instantaneousBpm(runTempo, b.targetMs - a.targetMs, b.playedMs - a.playedMs);
    if (instant <= 0 || !Number.isFinite(instant)) {
        return previous;
    }
    return Math.round(Math.min(180, Math.max(40, previous * 0.6 + instant * 0.4)));
}
