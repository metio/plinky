// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useRef, useState } from "react";
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
import { useMidiInput } from "../contexts/midi";

type RecorderOptions = {
    // The first completed note of a take — the "player has tried composing" signal.
    onFirstNote?: () => void;
    // Every key press as it happens (the on-screen keyboard follows what's played).
    onPitch?: (note: number) => void;
};

// Live note capture from whatever input the MIDI context carries (a real
// keyboard, the computer keys, the on-screen piano). The capture state machine
// is pure core; this hook owns its lifetime, feeds it the input events, and
// mirrors the completed note list into React state. Presses and releases go
// through a ref so the input subscription never re-subscribes mid-take.
export function useCompositionRecorder({ onFirstNote, onPitch }: RecorderOptions = {}) {
    const stateRef = useRef<RecordingState>(EMPTY_RECORDING);
    const [notes, setNotes] = useState<readonly RecordedNote[]>([]);
    // A checkpoint marks a note count worth keeping; null until one is set.
    const [checkpoint, setCheckpoint] = useState<number | null>(null);

    const callbacksRef = useRef({ onFirstNote, onPitch });
    callbacksRef.current = { onFirstNote, onPitch };

    const apply = useCallback((next: RecordingState) => {
        stateRef.current = next;
        setNotes(next.notes);
    }, []);

    const handleNoteOn = useCallback(
        (event: { note: number; velocity: number; timestamp: number }) => {
            stateRef.current = noteOn(stateRef.current, event);
            callbacksRef.current.onPitch?.(event.note);
        },
        [],
    );

    const handleNoteOff = useCallback(
        (event: { note: number; timestamp: number }) => {
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
        [apply],
    );

    useMidiInput({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff });

    const clear = useCallback(() => {
        apply(EMPTY_RECORDING);
        setCheckpoint(null);
    }, [apply]);

    const setCheckpointNow = useCallback(() => {
        setCheckpoint(stateRef.current.notes.length);
    }, []);

    // Read through a ref so the callback stays stable; a state updater must stay
    // pure, and truncating inside one would double-apply under StrictMode.
    const checkpointRef = useRef(checkpoint);
    checkpointRef.current = checkpoint;
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

    return { notes, checkpoint, setCheckpointNow, resetToCheckpoint, clear, load, anchorAt };
}
