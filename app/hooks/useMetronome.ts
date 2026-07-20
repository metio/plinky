// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";
import { grooveAccents } from "../../core/groove";
import { useAudioEngine, usePrefsStore, useScheduler } from "../contexts/services";

// Plays an audible click while `enabled`: an accented downbeat, a plainer click on
// every other beat, and — when `subdivision` > 1 — softer clicks dividing each beat
// (2 = eighths, 3 = triplets, 4 = sixteenths). Ticks are queued slightly ahead on
// the audio clock from a short polling loop (the standard Web Audio lookahead
// pattern), so the pulse stays steady where a bare setInterval would drift. Honours
// the sound and volume preferences, re-read each tick so muting takes effect
// immediately. The tempo is read live from a ref when each tick is queued, so an
// adaptive tempo that drifts with the player adjusts the spacing of the *next* tick
// without restarting the loop (which would reset the pulse and bunch clicks).
export function useMetronome(
    enabled: boolean,
    bpm: number,
    beatsPerBar: number,
    subdivision = 1,
    // Accent the downbeat louder than the other beats; off makes every beat equal
    // — the Settings-page voice control.
    accent = true,
): void {
    const bpmRef = useRef(bpm);
    bpmRef.current = bpm;
    const prefsStore = usePrefsStore();
    const audio = useAudioEngine();
    const scheduler = useScheduler();

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const start = audio.now();
        if (start === null) {
            return;
        }
        audio.resume();

        const beatsInBar = Math.max(1, beatsPerBar);
        const subs = Math.max(1, subdivision);
        let tick = 0; // counts subdivisions, so tick / subs is the beat
        let next = start + 0.1;

        // Queue every subdivision tick inside the lookahead window, spacing each
        // from the tempo current at the moment it is queued.
        const schedule = () => {
            const now = audio.now();
            if (now === null) {
                return;
            }
            // A backgrounded tab throttles this poll to >=1s while the audio clock keeps
            // advancing, so `next` can fall far behind. Advance the grid past every elapsed
            // beat without sounding it: this preserves the beat phase but resyncs to the
            // present. Queuing those past-due ticks instead would burst — osc.start(time)
            // with a time already gone starts immediately, so the whole cluster fires at once.
            while (next < now) {
                tick += 1;
                next += 60 / Math.max(1, bpmRef.current) / subs;
            }
            while (next < now + 0.12) {
                const onBeat = tick % subs === 0;
                const beatInBar = (tick / subs) % beatsInBar;
                const prefs = prefsStore.load();
                // Sub-beats stay soft; an on-beat the groove leans on is an accent (when
                // the accent voice is on), every other on-beat a plain beat. The groove is
                // read live, so switching it in Settings reshapes the pulse at once.
                const kind = !onBeat
                    ? "sub"
                    : accent && grooveAccents(prefs.metronomeGroove, beatInBar, beatsInBar)
                      ? "accent"
                      : "beat";
                const level = kind === "accent" ? 0.3 : kind === "beat" ? 0.18 : 0.08;
                const gain = prefs.sound ? level * (prefs.volume / 100) : 0;
                audio.click(next, kind, gain);
                tick += 1;
                next += 60 / Math.max(1, bpmRef.current) / subs;
            }
        };
        schedule();
        const timer = scheduler.every(25, schedule);
        return () => scheduler.cancel(timer);
    }, [enabled, beatsPerBar, subdivision, accent, audio, prefsStore, scheduler]);
}
