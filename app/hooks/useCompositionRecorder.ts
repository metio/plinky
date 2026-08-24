// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLatest } from "./useLatest";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordedNote } from "../../core/composition";
import {
    anchoredAt,
    EMPTY_RECORDING,
    noteOff,
    noteOn,
    type RecordingState,
    truncatedTo,
    withNotes,
} from "../../core/recording";
import {
    EMPTY_STEP,
    stepBack,
    stepDown,
    stepFrom,
    type StepState,
    stepRest,
    stepUp,
} from "../../core/stepInput";
import { useMidiInput } from "../contexts/midi";

type RecorderOptions = {
    // The first completed note of a take — the "player has tried composing" signal.
    onFirstNote?: () => void;
    // Every key press as it happens (the on-screen keyboard follows what's played).
    onPitch?: (note: number) => void;
    // How long a stepped note lasts, or null to record what is actually played. The
    // same keys drive both: in step entry a press writes a note of this length at the
    // next position rather than starting a stopwatch.
    stepMs?: number | null;
};

// Live note capture from whatever input the MIDI context carries (a real
// keyboard, the computer keys, the on-screen piano). The capture state machine
// is pure core; this hook owns its lifetime, feeds it the input events, and
// mirrors the completed note list into React state. Presses and releases go
// through a ref so the input subscription never re-subscribes mid-take.
export function useCompositionRecorder({
    onFirstNote,
    onPitch,
    stepMs = null,
}: RecorderOptions = {}) {
    const stateRef = useRef<RecordingState>(EMPTY_RECORDING);
    // The step machine, which owns the notes while step entry is on. Only one of the two
    // writes at a time; whichever it is, the note list below is what the rest of compose
    // reads, so the staff, the playback and the exports never learn there are two.
    const stepRef = useRef<StepState>(EMPTY_STEP);
    const steppingRef = useRef(stepMs !== null);
    const stepMsRef = useRef(stepMs ?? 0);
    stepMsRef.current = stepMs ?? stepMsRef.current;
    const [notes, setNotes] = useState<readonly RecordedNote[]>([]);
    // A checkpoint marks a note count worth keeping; null until one is set.
    const [checkpoint, setCheckpoint] = useState<number | null>(null);

    const callbacksRef = useLatest({ onFirstNote, onPitch });

    const apply = useCallback((next: RecordingState) => {
        stateRef.current = next;
        // Both machines are kept on the same notes, so turning step entry on or off in
        // the middle of a take carries the music across instead of starting again.
        stepRef.current = stepFrom(next.notes);
        setNotes(next.notes);
    }, []);

    const applyStep = useCallback((next: StepState) => {
        stepRef.current = next;
        stateRef.current = withNotes(next.notes);
        setNotes(next.notes);
    }, []);

    // Changing mode hands the take to the other machine, positioned at the end of what is
    // already there.
    useEffect(() => {
        const stepping = stepMs !== null;
        if (stepping === steppingRef.current) {
            return;
        }
        steppingRef.current = stepping;
        if (stepping) {
            stepRef.current = stepFrom(stateRef.current.notes);
        } else {
            stateRef.current = withNotes(stepRef.current.notes);
        }
    }, [stepMs]);

    const handleNoteOn = useCallback(
        (event: { note: number; velocity: number; timestamp: number }) => {
            if (steppingRef.current) {
                const first = stepRef.current.notes.length === 0;
                applyStep(
                    stepDown(
                        stepRef.current,
                        { pitch: event.note, velocity: event.velocity },
                        stepMsRef.current,
                    ),
                );
                callbacksRef.current.onPitch?.(event.note);
                if (first) {
                    // A stepped note is complete the moment it is written, unlike a played
                    // one, which is not a note until it is let go.
                    callbacksRef.current.onFirstNote?.();
                }
                return;
            }
            stateRef.current = noteOn(stateRef.current, event);
            callbacksRef.current.onPitch?.(event.note);
        },
        [applyStep],
    );

    const handleNoteOff = useCallback(
        (event: { note: number; timestamp: number }) => {
            if (steppingRef.current) {
                applyStep(stepUp(stepRef.current));
                return;
            }
            // Only a note the player completed themselves counts as the first —
            // loading a shared take is someone else's composing.
            const first = stateRef.current.notes.length === 0;
            const next = noteOff(stateRef.current, event);
            const landed = next.notes.length > stateRef.current.notes.length;
            apply(next);
            if (first && landed) {
                callbacksRef.current.onFirstNote?.();
            }
        },
        [apply, applyStep],
    );

    useMidiInput({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff });

    // A gap of the chosen length, and taking the last step back — the two things step
    // entry needs that playing does not.
    const rest = useCallback(() => {
        applyStep(stepRest(stepRef.current, stepMsRef.current));
    }, [applyStep]);
    const back = useCallback(() => {
        applyStep(stepBack(stepRef.current));
    }, [applyStep]);

    const clear = useCallback(() => {
        apply(EMPTY_RECORDING);
        stepRef.current = EMPTY_STEP;
        setCheckpoint(null);
    }, [apply]);

    const setCheckpointNow = useCallback(() => {
        setCheckpoint(stateRef.current.notes.length);
    }, []);

    // Read through a ref so the callback stays stable; a state updater must stay
    // pure, and truncating inside one would double-apply under StrictMode.
    const checkpointRef = useLatest(checkpoint);
    const resetToCheckpoint = useCallback(() => {
        if (checkpointRef.current !== null) {
            apply(truncatedTo(stateRef.current, checkpointRef.current));
        }
    }, [apply]);

    // Swap the take over to loaded notes (a share link or an opened file).
    const load = useCallback(
        (loaded: readonly RecordedNote[]) => {
            apply(withNotes(loaded));
            setCheckpoint(null);
        },
        [apply],
    );

    // Anchor the recording clock to a known instant — the downbeat a count-in
    // lands on — so what's played next sits on the metronome's grid.
    const anchorAt = useCallback((nowMs: number) => {
        stateRef.current = anchoredAt(stateRef.current, nowMs);
    }, []);

    return {
        notes,
        checkpoint,
        setCheckpointNow,
        resetToCheckpoint,
        clear,
        load,
        anchorAt,
        rest,
        back,
    };
}
