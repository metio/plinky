// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordedNote } from "../../core/composition";
import { tailMs } from "../../core/recording";
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
    const [playing, setPlaying] = useState(false);
    const [countingIn, setCountingIn] = useState(false);
    const timersRef = useRef<number[]>([]);

    const stop = useCallback(() => {
        for (const id of timersRef.current) {
            window.clearTimeout(id);
        }
        timersRef.current = [];
        setPlaying(false);
        setCountingIn(false);
    }, []);

    // Release any scheduled playback when the page goes away.
    useEffect(() => stop, [stop]);

    const play = useCallback(() => {
        stop();
        if (notes.length === 0) {
            return;
        }
        setPlaying(true);
        for (const note of notes) {
            const id = window.setTimeout(() => {
                playNote(note.pitch, {
                    velocity: note.velocity,
                    duration: Math.max(0.05, note.durationMs / 1000),
                });
            }, note.startMs);
            timersRef.current.push(id);
        }
        const end = window.setTimeout(() => setPlaying(false), tailMs(notes) + 200);
        timersRef.current.push(end);
    }, [notes, playNote, stop]);

    // Click one bar of lead-in, then hand the downbeat to the recorder so what's
    // played next sits on the grid, appending after any existing tail.
    const onDownbeatRef = useRef(onDownbeat);
    onDownbeatRef.current = onDownbeat;
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
        timersRef.current.push(
            window.setTimeout(() => {
                setCountingIn(false);
                onDownbeatRef.current(performance.now());
            }, barMs),
        );
    }, [beatsPerBar, tempo]);

    return { playing, play, stop, countingIn, countIn };
}
