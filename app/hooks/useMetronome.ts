// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioContext } from "../lib/audio";

// Lookahead scheduling (after Chris Wilson's "A Tale of Two Clocks"): a coarse
// timer wakes often and schedules every click that falls inside the next
// window directly on the audio clock, so playback stays sample-accurate even
// though setInterval itself is jittery. Background tabs throttle the timer, so
// a metronome left running while hidden may stutter — acceptable for practice.
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const CLICK_LENGTH_S = 0.04;

export type UseMetronomeResult = {
    running: boolean;
    beat: number; // 1-based beat within the bar while ticking, 0 when idle
    startMetronome: (bpm: number, beatsPerBar?: number) => void;
    countIn: (bpm: number, beats: number, onComplete: () => void, beatsPerBar?: number) => void;
    setTempo: (bpm: number) => void;
    stop: () => void;
};

export function useMetronome(): UseMetronomeResult {
    const ctxRef = useRef<AudioContext | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rafRef = useRef<number | null>(null);

    const nextNoteTimeRef = useRef(0);
    const beatIndexRef = useRef(0); // absolute beats scheduled since the last start
    const bpmRef = useRef(120);
    const beatsPerBarRef = useRef(4);
    const remainingRef = useRef(Number.POSITIVE_INFINITY); // beats left to schedule
    const onCompleteRef = useRef<(() => void) | null>(null);
    const queueRef = useRef<{ beat: number; time: number }[]>([]);

    const [running, setRunning] = useState(false);
    const [beat, setBeat] = useState(0);

    const scheduleClick = useCallback((ctx: AudioContext, time: number, accent: boolean) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = accent ? 1500 : 1000;
        // exponential ramps cannot touch zero, so the envelope rides just above it.
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_LENGTH_S);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + CLICK_LENGTH_S);
    }, []);

    const stopTimers = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (completeTimerRef.current !== null) {
            clearTimeout(completeTimerRef.current);
            completeTimerRef.current = null;
        }
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const stop = useCallback(() => {
        stopTimers();
        remainingRef.current = Number.POSITIVE_INFINITY;
        onCompleteRef.current = null;
        queueRef.current = [];
        setRunning(false);
        setBeat(0);
    }, [stopTimers]);

    // Advance the displayed beat to the latest click whose audio time has passed,
    // keeping the visual indicator aligned with what is actually sounding.
    const draw = useCallback(() => {
        const ctx = ctxRef.current;
        if (ctx) {
            let current = -1;
            while (queueRef.current.length > 0 && queueRef.current[0].time <= ctx.currentTime) {
                current = queueRef.current[0].beat;
                queueRef.current.shift();
            }
            if (current >= 0) {
                setBeat(current + 1);
            }
        }
        rafRef.current = requestAnimationFrame(draw);
    }, []);

    const scheduler = useCallback(() => {
        const ctx = ctxRef.current;
        if (!ctx) {
            return;
        }
        const secondsPerBeat = 60 / bpmRef.current;

        while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
            if (remainingRef.current <= 0) {
                // The count-in has scheduled all its beats; the run begins on the
                // downbeat that would follow, so fire completion at that instant.
                const when = nextNoteTimeRef.current;
                const onComplete = onCompleteRef.current;
                onCompleteRef.current = null;
                if (intervalRef.current !== null) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                completeTimerRef.current = setTimeout(
                    () => {
                        stop();
                        onComplete?.();
                    },
                    Math.max(0, (when - ctx.currentTime) * 1000),
                );
                return;
            }

            const beatInBar = beatIndexRef.current % beatsPerBarRef.current;
            scheduleClick(ctx, nextNoteTimeRef.current, beatInBar === 0);
            queueRef.current.push({ beat: beatInBar, time: nextNoteTimeRef.current });

            nextNoteTimeRef.current += secondsPerBeat;
            beatIndexRef.current += 1;
            if (remainingRef.current !== Number.POSITIVE_INFINITY) {
                remainingRef.current -= 1;
            }
        }
    }, [scheduleClick, stop]);

    const begin = useCallback(
        (bpm: number, beatsPerBar: number, limit: number, onComplete: (() => void) | null) => {
            let ctx = ctxRef.current;
            if (!ctx) {
                ctx = getAudioContext();
                if (!ctx) {
                    return;
                }
                ctxRef.current = ctx;
            }
            // The context may start suspended until a user gesture resumes it; the
            // caller is always a click, so this resolves promptly.
            void ctx.resume();

            stopTimers();
            bpmRef.current = bpm;
            beatsPerBarRef.current = beatsPerBar;
            remainingRef.current = limit;
            onCompleteRef.current = onComplete;
            beatIndexRef.current = 0;
            queueRef.current = [];
            nextNoteTimeRef.current = ctx.currentTime + 0.1;

            setRunning(true);
            setBeat(0);
            intervalRef.current = setInterval(scheduler, LOOKAHEAD_MS);
            rafRef.current = requestAnimationFrame(draw);
            scheduler();
        },
        [draw, scheduler, stopTimers],
    );

    const startMetronome = useCallback(
        (bpm: number, beatsPerBar = 4) => begin(bpm, beatsPerBar, Number.POSITIVE_INFINITY, null),
        [begin],
    );

    const countIn = useCallback(
        (bpm: number, beats: number, onComplete: () => void, beatsPerBar = 4) =>
            begin(bpm, beatsPerBar, beats, onComplete),
        [begin],
    );

    // Tempo is read fresh on every scheduled beat, so a change takes effect on
    // the next click without restarting the metronome.
    const setTempo = useCallback((bpm: number) => {
        bpmRef.current = bpm;
    }, []);

    // Only stop the timers on unmount; the AudioContext is shared and outlives
    // this component, so it must not be closed here.
    useEffect(() => stopTimers, [stopTimers]);

    return { running, beat, startMetronome, countIn, setTempo, stop };
}
