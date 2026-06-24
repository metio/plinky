// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import { buildSteps } from "../lib/steps";
import { useSynth } from "./useSynth";

// Plays a whole song so a learner can hear how it should sound before
// practicing. abcjs renders the ABC into a detached node, buildSteps flattens it
// to timed pitches, and each step is scheduled onto the shared synth — the same
// voice the trainers use, so no extra audio assets. Only one song plays at a
// time; `playingId` lets the UI show which.
export function usePlayer() {
    const synth = useSynth();
    const [playingId, setPlayingId] = useState<string | null>(null);
    const timers = useRef<number[]>([]);

    const stop = useCallback(() => {
        for (const id of timers.current) {
            window.clearTimeout(id);
        }
        timers.current = [];
        setPlayingId(null);
    }, []);

    const play = useCallback(
        async (songId: string, abc: string, tempo: number) => {
            stop();
            const { default: abcjs } = await import("abcjs");
            const element = document.createElement("div");
            const tune = abcjs.renderAbc(element, abc, {})[0];
            if (!tune) {
                return;
            }
            const steps = buildSteps(tune, tempo);
            if (steps.length === 0) {
                return;
            }
            setPlayingId(songId);
            steps.forEach((step, index) => {
                const next = steps[index + 1];
                // Ring each note until the next onset (a little extra on the last
                // one), so held notes sound held rather than clipped.
                const seconds = next ? Math.max(0.15, (next.timeMs - step.timeMs) / 1000) : 0.9;
                timers.current.push(
                    window.setTimeout(() => {
                        for (const pitch of step.pitches) {
                            synth.playNote(pitch, { duration: seconds });
                        }
                    }, step.timeMs),
                );
            });
            const lastStep = steps[steps.length - 1];
            const end = (lastStep ? lastStep.timeMs : 0) + 900;
            timers.current.push(window.setTimeout(() => setPlayingId(null), end));
        },
        [synth, stop],
    );

    // Cancel any pending notes if the component unmounts mid-playback.
    useEffect(() => stop, [stop]);

    return { play, stop, playingId };
}
