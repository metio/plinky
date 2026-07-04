// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useMemo } from "react";
import { useAudioEngine, usePrefsStore } from "../contexts/services";

export type PlayNoteOptions = {
    velocity?: number; // 0..127
    duration?: number; // seconds
    delay?: number; // seconds to wait before the strike, for scheduling a chord or arpeggio
};

export type UseSynthResult = {
    playNote: (note: number, options?: PlayNoteOptions) => void;
};

// Decides what a note press should sound like — loudness from velocity and the
// volume preference, silence when muted — and hands the strike to the injected
// audio engine. The synthesis itself lives behind the engine seam, so this hook
// tests against a fake that records strikes.
export function useSynth(): UseSynthResult {
    const prefsStore = usePrefsStore();
    const audio = useAudioEngine();
    const playNote = useCallback(
        (note: number, options: PlayNoteOptions = {}) => {
            const prefs = prefsStore.load();
            if (!prefs.sound) {
                return;
            }
            const gain = ((options.velocity ?? 90) / 127) * 0.32 * (prefs.volume / 100);
            // Volume 0 means silence; the engine's exponential ramps cannot target 0
            // either, so a silent strike never reaches it.
            if (gain <= 0) {
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
        [prefsStore, audio],
    );

    // A stable result so callers can list the synth in an effect's dependencies without
    // the effect re-firing every render — playNote itself never changes.
    return useMemo(() => ({ playNote }), [playNote]);
}
