// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useTimerChain } from "./useTimerChain";
import { useLatest } from "./useLatest";
import { useCallback, useRef, useState } from "react";
import type { RecordedNote } from "../../core/composition";
import { tailMs } from "../../core/recording";
import { useScheduler } from "../contexts/services";
import { useSynth } from "./useSynth";

type TransportOptions = {
    notes: readonly RecordedNote[];
    tempo: number;
    beatsPerBar: number;
    // The downbeat a completed count-in lands on: the moment to anchor the
    // recording clock and leave the metronome running.
    onDownbeat: (nowMs: number) => void;
};

// The compose page's transport: replaying the take through the synth, and the
// one-bar count-in. Both schedule timeouts into one pool, so stop() — also run
// on unmount — cancels everything at once: an armed count-in left to fire after
// a clear would re-anchor the clock, turn the metronome on, and set state on an
// unmounted page.
export function useCompositionTransport({
    notes,
    tempo,
    beatsPerBar,
    onDownbeat,
}: TransportOptions) {
    const { playNote } = useSynth();
    const scheduler = useScheduler();
    const [playing, setPlaying] = useState(false);
    const [countingIn, setCountingIn] = useState(false);
    // One pool of timers, cleared together — useTimerChain already owns that, including
    // releasing what is still scheduled when the page goes away.
    const timers = useTimerChain();

    const stop = useCallback(() => {
        timers.clear();
        setPlaying(false);
        setCountingIn(false);
    }, [timers]);

    const play = useCallback(() => {
        stop();
        if (notes.length === 0) {
            return;
        }
        setPlaying(true);
        for (const note of notes) {
            timers.push(() => {
                playNote(note.pitch, {
                    velocity: note.velocity,
                    duration: Math.max(0.05, note.durationMs / 1000),
                });
            }, note.startMs);
        }
        timers.push(() => setPlaying(false), tailMs(notes) + 200);
    }, [notes, playNote, stop, timers]);

    // Click one bar of lead-in, then hand the downbeat to the recorder so what's
    // played next sits on the grid, appending after any existing tail.
    const onDownbeatRef = useLatest(onDownbeat);
    // Guarded through a ref, not a state updater — scheduling inside an updater
    // would double-arm under StrictMode.
    const countingInRef = useRef(false);
    countingInRef.current = countingIn;
    const countIn = useCallback(() => {
        if (countingInRef.current) {
            return;
        }
        setCountingIn(true);
        const barMs = beatsPerBar * (60_000 / tempo);
        timers.push(() => {
            setCountingIn(false);
            onDownbeatRef.current(scheduler.now());
        }, barMs);
    }, [beatsPerBar, tempo, scheduler, timers]);

    return { playing, play, stop, countingIn, countIn };
}
