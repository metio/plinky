// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useMemo } from "react";
import type { PedalKind } from "../../core/pedals";
import { useAudioEngine, usePrefsStore } from "../contexts/services";

export type PlayNoteOptions = {
    velocity?: number; // 0..127
    duration?: number; // seconds
    delay?: number; // seconds to wait before the strike, for scheduling a chord or arpeggio
};

export type UseSynthResult = {
    // A fixed-length note for Listen and replay — the caller sets the duration.
    playNote: (note: number, options?: PlayNoteOptions) => void;
    // A live voice for a held key: it rings until releaseNote (or the pedal lifts), so the
    // sound follows the player's own key hold. A quick release sounds staccato, a long hold
    // sustains — the articulation the player actually gave.
    pressNote: (note: number, options?: { velocity?: number }) => void;
    // holdScale (default 1) lets an imprecise input's short tap ring on; see the engine's
    // release. A real MIDI key leaves it at 1.
    releaseNote: (note: number, holdScale?: number) => void;
    // Move one of the three pedals for live voices.
    setPedal: (pedal: PedalKind, down: boolean) => void;
    // Silence every live voice and drop all held/pedal state — the panic a play surface
    // calls on teardown so a guide voice can never ring on past the run.
    silenceAll: () => void;
};

// Decides what a note should sound like — loudness from velocity and the volume
// preference, silence when muted — and hands it to the injected audio engine. Listen and
// replay strike fixed-length notes; live play presses and releases voices so the sound
// tracks the key hold. The synthesis lives behind the engine seam, so this hook tests
// against a fake that records what would have sounded.
export function useSynth(): UseSynthResult {
    const prefsStore = usePrefsStore();
    const audio = useAudioEngine();

    // The final loudness for a velocity, after the volume preference — or null when muted
    // or silent, so a silent note never reaches the engine's exponential ramps.
    const gainFor = useCallback(
        (velocity: number): number | null => {
            const prefs = prefsStore.load();
            if (!prefs.sound) {
                return null;
            }
            const gain = (velocity / 127) * 0.32 * (prefs.volume / 100);
            return gain > 0 ? gain : null;
        },
        [prefsStore],
    );

    const playNote = useCallback(
        (note: number, options: PlayNoteOptions = {}) => {
            const gain = gainFor(options.velocity ?? 90);
            if (gain === null) {
                return;
            }
            audio.resume();
            audio.strike({
                note,
                gain,
                duration: options.duration ?? 1.1,
                delay: Math.max(0, options.delay ?? 0),
            });
        },
        [gainFor, audio],
    );

    const pressNote = useCallback(
        (note: number, options: { velocity?: number } = {}) => {
            const gain = gainFor(options.velocity ?? 90);
            if (gain === null) {
                return;
            }
            audio.resume();
            audio.press(note, gain);
        },
        [gainFor, audio],
    );

    // Release and pedal always reach the engine — a muted session opened no voice, so they
    // are harmless no-ops there, and the pedal state must track regardless of volume.
    const releaseNote = useCallback(
        (note: number, holdScale?: number) => audio.release(note, holdScale),
        [audio],
    );
    const setPedal = useCallback(
        (pedal: PedalKind, down: boolean) => audio.setPedal(pedal, down),
        [audio],
    );
    // Reaches the engine regardless of the volume preference — it clears voices and
    // pedal state, which must happen even for a muted session that opened none.
    const silenceAll = useCallback(() => audio.allNotesOff(), [audio]);

    // A stable result so callers can list the synth in an effect's dependencies without the
    // effect re-firing every render.
    return useMemo(
        () => ({ playNote, pressNote, releaseNote, setPedal, silenceAll }),
        [playNote, pressNote, releaseNote, setPedal, silenceAll],
    );
}
