// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import { getAudioContext } from "../lib/audio";
import { loadPrefs } from "../lib/prefs";

// Plays an audible click on each beat at `bpm` while `enabled`, accenting the
// first beat of every bar. Beats are queued slightly ahead on the audio clock
// from a short polling loop (the standard Web Audio lookahead pattern), so the
// pulse stays steady where a bare setInterval would drift. Honours the sound and
// volume preferences, re-read each beat so muting takes effect immediately.
export function useMetronome(enabled: boolean, bpm: number, beatsPerBar: number): void {
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const ctx = getAudioContext();
        if (!ctx) {
            return;
        }
        ctx.resume().catch(() => {});

        const secondsPerBeat = 60 / Math.max(1, bpm);
        const beatsInBar = Math.max(1, beatsPerBar);
        let beat = 0;
        let next = ctx.currentTime + 0.1;

        const click = (time: number, accent: boolean) => {
            const prefs = loadPrefs();
            const peak = (accent ? 0.3 : 0.18) * (prefs.volume / 100);
            if (!prefs.sound || peak <= 0) {
                return;
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = accent ? 1600 : 1000;
            // A short percussive blip; exponential ramps can't reach 0, so ride
            // just above it.
            gain.gain.setValueAtTime(0.0001, time);
            gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(time);
            osc.stop(time + 0.06);
        };

        // Queue every beat that falls inside the next lookahead window.
        const schedule = () => {
            while (next < ctx.currentTime + 0.12) {
                click(next, beat % beatsInBar === 0);
                beat += 1;
                next += secondsPerBeat;
            }
        };
        schedule();
        const timer = window.setInterval(schedule, 25);
        return () => window.clearInterval(timer);
    }, [enabled, bpm, beatsPerBar]);
}
