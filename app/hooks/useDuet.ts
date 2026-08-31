// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLatest } from "./useLatest";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useEffect, useRef } from "react";
import { type AccompanyVoice, accompanimentForGap, gapsForRun } from "../../core/duet";
import type { Hand } from "../../core/matcher";
import type { Scheduler, SchedulerHandle } from "../ports/scheduler";
import type { PlayNoteOptions } from "./useSynth";
import { collectMatchSteps } from "./useScoreMatcher";

// The hand the app plays when you practise the other one.
const OTHER: Record<Exclude<Hand, "both">, Exclude<Hand, "both">> = {
    right: "left",
    left: "right",
};

// Sounds the sitting-out hand during self-paced single-hand practice. `prime` reads
// the run's two hands off the engraved score once at the start; `onCleared`, called
// each time you clear one of your notes with your current live tempo, cancels the
// previous gap's pending notes (re-lock) and schedules the accompanying hand up to
// your next note. Tempo-enforced keep-up runs already play the other hand on their
// own clock, so this stays inert there (its `enabled` gate is off).
//
// The pure timing lives in core/duet; this hook owns the OSMD read, the synth and
// the injected scheduler.
export function useDuet({
    getOsmd,
    playNote,
    scheduler,
    enabled,
    hand,
}: {
    getOsmd: () => OpenSheetMusicDisplay | null;
    playNote: (note: number, options?: PlayNoteOptions) => void;
    scheduler: Scheduler;
    enabled: boolean;
    hand: Hand;
}) {
    // Your notes' onsets, addressed by the whole-piece step index onCorrect reports,
    // and the accompanying hand's notes to place between them.
    const onsetsRef = useRef<number[]>([]);
    // The accompanying hand's notes, already grouped by which of your notes opens their
    // gap — see gapsForRun.
    const gapsRef = useRef<AccompanyVoice[][]>([]);
    const pendingRef = useRef<SchedulerHandle[]>([]);
    // Read live inside the callbacks so a mid-render toggle or hand change takes
    // effect on the next primed run without re-creating them.
    const enabledRef = useLatest(enabled);
    const handRef = useLatest(hand);

    const cancel = useCallback(() => {
        for (const handle of pendingRef.current) {
            scheduler.cancel(handle);
        }
        pendingRef.current = [];
    }, [scheduler]);

    const prime = useCallback(() => {
        cancel();
        onsetsRef.current = [];
        gapsRef.current = [];
        const osmd = getOsmd();
        const chosen = handRef.current;
        if (!osmd || !enabledRef.current || chosen === "both") {
            return;
        }
        const mine = collectMatchSteps(osmd, chosen);
        onsetsRef.current = mine.map((step) => step.whole);
        // Bucketed once, here, rather than searched per gap: which of your notes a note of
        // theirs belongs to is a property of the two walks, and it does not change as you
        // play. It is also the only place both walks are in hand at once, which is what
        // deciding it on elapsed time needs.
        gapsRef.current = gapsForRun(
            mine,
            collectMatchSteps(osmd, OTHER[chosen]).flatMap((step) =>
                step.pitches.map((pitch) => ({
                    pitch,
                    whole: step.whole,
                    elapsedMs: step.elapsedMs,
                    quarters: step.holdQuarters,
                })),
            ),
        );
    }, [getOsmd, cancel]);

    // Clear the gap opened by your note at whole-piece index `index`, playing the
    // accompanying hand across it at `bpm` (your live, adaptive pace).
    const onCleared = useCallback(
        (index: number, bpm: number) => {
            if (!enabledRef.current) {
                return;
            }
            const from = onsetsRef.current[index];
            if (from === undefined) {
                return;
            }
            cancel();
            for (const voice of accompanimentForGap(gapsRef.current[index] ?? [], from, bpm)) {
                if (voice.delayMs <= 0) {
                    playNote(voice.pitch, { duration: voice.durationSec });
                    continue;
                }
                pendingRef.current.push(
                    scheduler.after(voice.delayMs, () =>
                        playNote(voice.pitch, { duration: voice.durationSec }),
                    ),
                );
            }
        },
        [cancel, playNote, scheduler],
    );

    // Turning the duet off — or leaving the surface — must not leave a scheduled
    // note to sound after the run it belonged to.
    useEffect(() => {
        if (!enabled) {
            cancel();
        }
    }, [enabled, cancel]);
    useEffect(() => cancel, [cancel]);

    return { prime, onCleared, cancel };
}
