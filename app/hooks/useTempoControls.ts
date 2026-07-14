// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefsStore } from "../contexts/services";
import { usePref } from "./usePref";
import { type RunCapture, liveTempo as nextLiveTempo } from "../../core/runCapture";

// The play surface's tempo settings, held as one unit: the slider tempo, the adaptive
// "live" tempo that eases toward the player's own pace, the metronome's own toggles
// (on/off, subdivision, adaptive), and the tempo trainer that ramps the speed up after
// each completed run. The metronome *effect* itself stays at the call site — it reads
// the keep-up transport's running flag, which is created after this hook — so this owns
// the state the metronome (and the drawer) read, not the audio loop.
export type TempoControls = {
    // The slider tempo: the reference Listen, the count and the matcher run at.
    tempo: number;
    setTempo: (value: number | ((current: number) => number)) => void;
    // The adaptive metronome's current pace, eased toward the player's note timing.
    liveTempo: number;
    // A stable reader of the live slider tempo, for transports that read it mid-play
    // without restarting (so moving the slider retimes the next step, not the loop).
    readTempo: () => number;
    // Reset the adaptive live tempo back to the slider tempo — a run starts from there.
    resyncLive: () => void;
    // Ease the adaptive tempo toward the pace read from the last two captured notes.
    easeToward: (capture: RunCapture, runTempo: number) => void;
    metronomeOn: boolean;
    setMetronomeOn: (on: boolean) => void;
    subdivision: number;
    setSubdivision: (value: number) => void;
    adaptive: boolean;
    setAdaptive: (on: boolean) => void;
    trainerOn: boolean;
    setTrainerOn: (on: boolean) => void;
    trainerTarget: number;
    setTrainerTarget: (value: number) => void;
    // Nudge the tempo up one step toward the trainer target, once per completed run —
    // a no-op when the trainer is off. Reads its setting from a ref so a completion
    // handler created earlier still sees the live toggle.
    bumpTempo: () => void;
};

export function useTempoControls({
    initialTempo,
}: {
    // The piece's own tempo, the starting point for the slider, the live pace and the count.
    initialTempo: number;
}): TempoControls {
    const [tempo, setTempo] = useState(initialTempo);
    const [liveTempo, setLiveTempo] = useState(initialTempo);
    const [metronomeOn, setMetronomeOn] = useState(false);
    const prefsStore = usePrefsStore();
    // The metronome's voice — how finely each beat divides (1 = beats, 2 =
    // eighths, 3 = triplets, 4 = sixteenths) and whether it follows the player's
    // own pace — is set once in Settings and persists across pieces.
    const [subdivision, setSubdivision] = usePref(prefsStore, "metronomeSubdivision");
    const [adaptive, setAdaptive] = usePref(prefsStore, "metronomeAdaptive");
    // The tempo trainer ramps the tempo up by a step after each completed run, up to
    // a target — practising a piece from comfortable to performance speed.
    const [trainerOn, setTrainerOn] = useState(false);
    const [trainerTarget, setTrainerTarget] = useState(140);
    const trainerRef = useRef({ on: false, target: 140 });
    trainerRef.current = { on: trainerOn, target: trainerTarget };

    // The live slider tempo, so a transport reads the current value from a stable ref
    // without a fresh closure per render.
    const tempoRef = useRef(initialTempo);
    useEffect(() => {
        tempoRef.current = tempo;
    }, [tempo]);

    const readTempo = useCallback(() => tempoRef.current, []);
    const resyncLive = useCallback(() => setLiveTempo(tempoRef.current), []);
    const easeToward = useCallback((capture: RunCapture, runTempo: number) => {
        setLiveTempo((prev) => nextLiveTempo(capture, runTempo, prev));
    }, []);
    // Stable so a completion effect can depend on it without re-running; it reads the
    // trainer setting from a ref, so an empty dependency list is correct.
    const bumpTempo = useCallback(() => {
        if (trainerRef.current.on) {
            // Ramp up toward the target only; when the slider is already at or above it,
            // leave the tempo alone rather than snapping it down.
            const target = trainerRef.current.target;
            setTempo((current) => (current >= target ? current : Math.min(current + 5, target)));
        }
    }, []);

    return {
        tempo,
        setTempo,
        liveTempo,
        readTempo,
        resyncLive,
        easeToward,
        metronomeOn,
        setMetronomeOn,
        subdivision,
        setSubdivision,
        adaptive,
        setAdaptive,
        trainerOn,
        setTrainerOn,
        trainerTarget,
        setTrainerTarget,
        bumpTempo,
    };
}
