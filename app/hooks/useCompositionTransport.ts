// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useTimerChain } from "./useTimerChain";
import { useLatest } from "./useLatest";
import { useCallback, useRef, useState } from "react";
import type { RecordedNote } from "../../core/composition";
import { tailMs } from "../../core/recording";
import { useAudioEngine, useScheduler } from "../contexts/services";
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
    const audio = useAudioEngine();
    const [playing, setPlaying] = useState(false);
    const [countingIn, setCountingIn] = useState(false);
    // Where the count-in laid its grid on the audio clock, for the metronome to lay its
    // clicks on the same one. Null until a count-in has run.
    const [anchor, setAnchor] = useState<number | null>(null);
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
        const downbeat = () => {
            setCountingIn(false);
            onDownbeatRef.current(scheduler.now());
        };
        const start = audio.now();
        if (start === null) {
            // No audio clock to lay a grid on: a bar of wall-clock time is all there is.
            timers.push(downbeat, beatsPerBar * (60_000 / tempo));
            return;
        }
        // The grid is laid on the audio clock, where the clicks are: the first click lands
        // a tenth of a second out — the metronome's own lead — and the downbeat one bar
        // after it. Timing the downbeat from the moment this was called instead put the
        // recorder's zero a tenth of a second and a render ahead of the click the player
        // was counting on, and every note they placed on a click recorded late.
        const at = start + 0.1;
        setAnchor(at);
        const downbeatAt = at + beatsPerBar * (60 / tempo);
        timers.push(downbeat, Math.max(0, (downbeatAt - start) * 1000));
    }, [beatsPerBar, tempo, scheduler, audio, timers]);

    return { playing, play, stop, countingIn, countIn, anchor };
}
