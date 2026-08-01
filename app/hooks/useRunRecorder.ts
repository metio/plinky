// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo, useRef } from "react";
import {
    captureCleared,
    capturePedal,
    captureRelease,
    type ClearedNote,
    flushHolds,
    type RunCapture,
    startCapture,
} from "../../core/runCapture";

// The run's recording: every cleared note's ideal and actual timing, the velocities,
// the real key-hold lengths as releases land, and the pedal's damper model.
//
// core/runCapture already owns what any of that means. What lived in the play surface
// was only the fact that one capture is shared by six callers who never meet — the
// matcher's cleared-note callback, the MIDI release and pedal handlers, the run
// starter, the grader and the take-saver — each reaching into the same mutable record
// between renders.
//
// Gathering them here does not change that shape; it names it. The capture is still
// one object mutated in place, because a note-off arriving between renders has nowhere
// else to write. But every write now goes through a method with a reason attached, and
// a test can play a whole run through this hook without a staff, a cursor or a
// keyboard.

export type RunRecorder = {
    // Begin recording. A fresh capture zeroes the run clock, so anything gated on the
    // first note landing — the ghost's start, the tempo curve — stays shut until it
    // does. `pedalDown` seeds the damper: Web MIDI streams pedal changes and never the
    // standing state, so a pedal already held as the run starts is invisible otherwise,
    // and the run's first notes would record dry despite ringing under it.
    begin(options: { tempo: number; partial: boolean; pedalDown: boolean; at: number }): void;
    // A position cleared. Records its timing and opens a hold per pitch for the
    // release to close, then eases the adaptive metronome toward the player's own pace.
    cleared(info: ClearedNote): void;
    // A key lifted, which fills in that note's real hold length — unless the sustain
    // pedal is down, in which case the note rings on and its hold stays open.
    released(pitch: number, at: number): void;
    // The sustain pedal moved. Lifting it closes every hold it was keeping open.
    pedal(down: boolean, at: number): void;
    // Input that carries no true velocity or rhythm played into this run, so it is
    // graded with widened timing windows.
    markImprecise(): void;
    // Close every hold still open — the run has ended, so a key still down records its
    // real length now rather than a clipped beat. Idempotent.
    flush(at: number): void;

    // The capture itself, for the readers that take it whole (grading, the take save).
    capture: { current: RunCapture };
    // The run clock's zero: 0 until the first cleared note lands.
    startedAt(): number;
    // The tempo this run is matched at, and whether it began partway through the piece.
    tempo: { current: number };
    partial: { current: boolean };
};

export function useRunRecorder(
    initialTempo: number,
    // Nudges the adaptive metronome toward the player's own pace, read from the gap
    // between the last two notes. Owned by the tempo controls, so it arrives as a
    // parameter and is read live rather than captured once.
    easeToward: (capture: RunCapture, runTempo: number) => void,
): RunRecorder {
    const capture = useRef<RunCapture>(startCapture());
    const tempo = useRef(initialTempo);
    const partial = useRef(false);
    const ease = useRef(easeToward);
    ease.current = easeToward;

    // One object for the hook's life: every method reads a ref, so nothing here is
    // rebuilt per render and a caller may depend on it without churn.
    return useMemo<RunRecorder>(
        () => ({
            capture,
            tempo,
            partial,
            startedAt: () => capture.current.startedAt,
            begin: ({ tempo: runTempo, partial: fromPartway, pedalDown, at }) => {
                capture.current = startCapture();
                tempo.current = runTempo;
                partial.current = fromPartway;
                if (pedalDown) {
                    // Stamped on the same clock every hold is, so the capture stays
                    // single-clock throughout; the seed's own time goes unused while
                    // the pedal stays down.
                    capturePedal(capture.current, true, at);
                }
            },
            cleared: (info) => {
                captureCleared(capture.current, info);
                ease.current(capture.current, tempo.current);
            },
            released: (pitch, at) => captureRelease(capture.current, pitch, at),
            pedal: (down, at) => capturePedal(capture.current, down, at),
            markImprecise: () => {
                capture.current.imprecise = true;
            },
            flush: (at) => flushHolds(capture.current, at),
        }),
        [],
    );
}
