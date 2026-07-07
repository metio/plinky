// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";
import { useAudioEngine, usePrefsStore } from "../contexts/services";

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
): void {
    const bpmRef = useRef(bpm);
    bpmRef.current = bpm;
    const prefsStore = usePrefsStore();
    const audio = useAudioEngine();

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
                const downbeat = (tick / subs) % beatsInBar === 0;
                const kind = !onBeat ? "sub" : downbeat ? "accent" : "beat";
                const prefs = prefsStore.load();
                const level = kind === "accent" ? 0.3 : kind === "beat" ? 0.18 : 0.08;
                const gain = prefs.sound ? level * (prefs.volume / 100) : 0;
                audio.click(next, kind, gain);
                tick += 1;
                next += 60 / Math.max(1, bpmRef.current) / subs;
            }
        };
        schedule();
        const timer = window.setInterval(schedule, 25);
        return () => window.clearInterval(timer);
    }, [enabled, beatsPerBar, subdivision, audio, prefsStore]);
}
