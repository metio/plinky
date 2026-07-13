// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { MicCalibration } from "./pitch";
import { SILENCE_RMS } from "./pitch";

// The calibration wizard's pure brain: fold a stream of raw microphone
// measurements — one per animation frame, as the player follows the on-screen
// steps — into the three tuning numbers the detector needs for this room, this
// piano and this microphone. No audio, no React, no timers here: the adapter
// supplies frames, this decides when a step has enough, and the last step
// yields a MicCalibration. That keeps the whole judgement testable with a
// scripted array of samples.

// One frame the wizard hears while a step runs: its loudness and the notes the
// RAW (uncalibrated) detector picked out — calibration is derived from what the
// unadjusted detector reports, or it would chase its own tail.
export type CalibrationSample = {
    rms: number;
    notes: number[];
};

// The steps in order. `quiet` measures the room's noise, `note` confirms pitch
// and octave against a named target, `soft` and `loud` capture the ends of the
// player's dynamic range, `done` holds the finished calibration.
export type CalibrationStep = "quiet" | "note" | "soft" | "loud" | "done";

const STEP_ORDER: CalibrationStep[] = ["quiet", "note", "soft", "loud", "done"];

// How many frames each measuring step needs before it is satisfied. ~60 frames
// a second, so these are fractions of a second of steady signal — long enough
// to average out a transient, short enough not to try the player's patience.
const QUIET_FRAMES = 30;
const NOTE_FRAMES = 12;
const LEVEL_FRAMES = 15;

// The floor never drops so low the detector fires on noise, nor climbs so high
// it swallows real soft playing — even if a step caught a freak reading.
const MIN_FLOOR = 0.003;
const MAX_FLOOR = 0.2;
// The loudness anchors live in the same guarded band; the loud anchor is always
// held clear of the soft one so the velocity map can't collapse.
const MIN_LEVEL = 0.003;
const MAX_LEVEL = 0.5;

export type CalibrationState = {
    step: CalibrationStep;
    // The note the player is asked to strike in the `note` step (MIDI number).
    targetNote: number;
    // Per-step collectors, each filled only while its step is current.
    ambient: number[];
    heardNotes: number[];
    softHits: number[];
    loudHits: number[];
};

export function beginCalibration(targetNote = 60): CalibrationState {
    return { step: "quiet", targetNote, ambient: [], heardNotes: [], softHits: [], loudHits: [] };
}

// Fold one frame into the current step's collector, returning a new state. A
// note-bearing frame is a "hit" for the loudness and pitch steps; `quiet`
// records every frame, since silence is exactly what it measures.
export function observe(state: CalibrationState, sample: CalibrationSample): CalibrationState {
    const sounding = sample.notes.length > 0;
    switch (state.step) {
        case "quiet":
            return { ...state, ambient: [...state.ambient, sample.rms] };
        case "note":
            return sounding
                ? { ...state, heardNotes: [...state.heardNotes, sample.notes[0]!] }
                : state;
        case "soft":
            return sounding ? { ...state, softHits: [...state.softHits, sample.rms] } : state;
        case "loud":
            return sounding ? { ...state, loudHits: [...state.loudHits, sample.rms] } : state;
        default:
            return state;
    }
}

function collected(state: CalibrationState): number {
    switch (state.step) {
        case "quiet":
            return state.ambient.length;
        case "note":
            return state.heardNotes.length;
        case "soft":
            return state.softHits.length;
        case "loud":
            return state.loudHits.length;
        default:
            return 0;
    }
}

function needed(step: CalibrationStep): number {
    switch (step) {
        case "quiet":
            return QUIET_FRAMES;
        case "note":
            return NOTE_FRAMES;
        case "soft":
        case "loud":
            return LEVEL_FRAMES;
        default:
            return 0;
    }
}

// How full the current step is, 0..1 — drives the wizard's progress ring.
export function stepProgress(state: CalibrationState): number {
    const target = needed(state.step);
    return target === 0 ? 1 : Math.min(1, collected(state) / target);
}

// Whether the current step has heard enough to move on.
export function stepReady(state: CalibrationState): boolean {
    return state.step !== "done" && collected(state) >= needed(state.step);
}

// The note the detector is settling on right now in the `note` step, corrected
// to the target's octave for a friendly "we can hear your C!" read-out — null
// until a note is heard. Uses the running majority so one stray frame doesn't
// flip the display.
export function heardNote(state: CalibrationState): number | null {
    if (state.step !== "note" || state.heardNotes.length === 0) {
        return null;
    }
    return mode(state.heardNotes);
}

// Advance to the next step (a no-op at `done`), leaving the collectors intact —
// each step fills its own, so deriveCalibration sees them all at the end.
export function nextStep(state: CalibrationState): CalibrationState {
    const index = STEP_ORDER.indexOf(state.step);
    const next = STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]!;
    return { ...state, step: next };
}

// Turn everything measured into the calibration. Every field is guarded so a
// sparse or freak run still yields a usable, non-destructive result: an empty
// collector falls back to the detector's own defaults.
export function deriveCalibration(state: CalibrationState): MicCalibration {
    const ambientPeak = percentile(state.ambient, 0.95);
    const noiseFloor =
        ambientPeak === null ? SILENCE_RMS : clamp(ambientPeak * 1.8, MIN_FLOOR, MAX_FLOOR);

    const detected = median(state.heardNotes);
    const octaveShift =
        detected === null ? 0 : clamp(Math.round((state.targetNote - detected) / 12), -2, 2);

    const softMedian = median(state.softHits);
    const loudMedian = median(state.loudHits);
    const softLevel = softMedian === null ? SILENCE_RMS : clamp(softMedian, MIN_LEVEL, MAX_LEVEL);
    // The loud anchor sits at least a hair above the soft one, so the velocity
    // map never divides by a zero span.
    const loudLevel =
        loudMedian === null
            ? Math.max(0.35, softLevel * 2)
            : clamp(Math.max(loudMedian, softLevel * 1.5), MIN_LEVEL, MAX_LEVEL);

    return { noiseFloor, softLevel, loudLevel, octaveShift };
}

function clamp(value: number, low: number, high: number): number {
    return Math.max(low, Math.min(high, value));
}

function median(xs: number[]): number | null {
    if (xs.length === 0) {
        return null;
    }
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// The p-th value (0..1) of the sorted samples by nearest rank — a robust "peak"
// that ignores the single loudest outlier a strict max would seize on.
function percentile(xs: number[], p: number): number | null {
    if (xs.length === 0) {
        return null;
    }
    const sorted = [...xs].sort((a, b) => a - b);
    const rank = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return sorted[rank]!;
}

// The most frequent value, ties broken toward the smaller — the detector's
// steady reading through occasional wrong frames.
function mode(xs: number[]): number | null {
    if (xs.length === 0) {
        return null;
    }
    const counts = new Map<number, number>();
    let best = xs[0]!;
    let bestCount = 0;
    for (const x of xs) {
        const count = (counts.get(x) ?? 0) + 1;
        counts.set(x, count);
        if (count > bestCount || (count === bestCount && x < best)) {
            best = x;
            bestCount = count;
        }
    }
    return best;
}
