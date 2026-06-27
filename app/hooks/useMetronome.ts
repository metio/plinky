// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";
import { getAudioContext } from "../lib/audio";
import { loadPrefs } from "../lib/prefs";

type Tick = "accent" | "beat" | "sub";

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

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const ctx = getAudioContext();
        if (!ctx) {
            return;
        }
        ctx.resume().catch(() => {});

        const beatsInBar = Math.max(1, beatsPerBar);
        const subs = Math.max(1, subdivision);
        let tick = 0; // counts subdivisions, so tick / subs is the beat
        let next = ctx.currentTime + 0.1;

        const click = (time: number, kind: Tick) => {
            const prefs = loadPrefs();
            const level = kind === "accent" ? 0.3 : kind === "beat" ? 0.18 : 0.08;
            const peak = level * (prefs.volume / 100);
            if (!prefs.sound || peak <= 0) {
                return;
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = kind === "accent" ? 1600 : kind === "beat" ? 1000 : 800;
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

        // Queue every subdivision tick inside the lookahead window, spacing each
        // from the tempo current at the moment it is queued.
        const schedule = () => {
            while (next < ctx.currentTime + 0.12) {
                const onBeat = tick % subs === 0;
                const downbeat = (tick / subs) % beatsInBar === 0;
                click(next, !onBeat ? "sub" : downbeat ? "accent" : "beat");
                tick += 1;
                next += 60 / Math.max(1, bpmRef.current) / subs;
            }
        };
        schedule();
        const timer = window.setInterval(schedule, 25);
        return () => window.clearInterval(timer);
    }, [enabled, beatsPerBar, subdivision]);
}
