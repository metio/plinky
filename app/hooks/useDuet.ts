// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLatest } from "./useLatest";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AccompanyVoice, accompanimentForGap, gapsForRun } from "../../core/duet";
import type { Hand } from "../../core/matcher";
import type { StrikeOwner } from "../ports/audioEngine";
import type { Scheduler, SchedulerHandle } from "../ports/scheduler";
import { collectMatchSteps } from "./useScoreMatcher";

// The hand the app plays when you practise the other one.
const OTHER: Record<Exclude<Hand, "both">, Exclude<Hand, "both">> = {
    right: "left",
    left: "right",
};

// The synth slice the duet needs: a fixed-length note for the other hand, and a stop that
// takes back what it struck.
type NoteSink = {
    playNote(note: number, options?: { duration?: number; owner?: StrikeOwner }): void;
    silenceStrikes(owner: StrikeOwner): void;
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
    synth,
    scheduler,
    enabled,
    hand,
}: {
    getOsmd: () => OpenSheetMusicDisplay | null;
    synth: NoteSink;
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
    // Every note the duet strikes goes out under this, so its stop can take back exactly
    // the other hand's notes and never the ones the player is sounding.
    const [owner] = useState<StrikeOwner>(() => Symbol("duet"));
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

    // The run is over before its end: the player stopped it, or another transport took
    // the surface. A gap is scheduled whole — a rest in your hand can queue bars of the
    // other — and each note is a strike that rings its full length, so both the timers
    // and the notes already sounding have to go.
    const stop = useCallback(() => {
        cancel();
        synth.silenceStrikes(owner);
    }, [cancel, synth, owner]);

    const prime = useCallback(() => {
        stop();
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
    }, [getOsmd, stop]);

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
                const strike = () =>
                    synth.playNote(voice.pitch, { duration: voice.durationSec, owner });
                if (voice.delayMs <= 0) {
                    strike();
                    continue;
                }
                pendingRef.current.push(scheduler.after(voice.delayMs, strike));
            }
        },
        [cancel, synth, owner, scheduler],
    );

    // Turning the duet off — or leaving the surface — must not leave a scheduled
    // note to sound after the run it belonged to.
    useEffect(() => {
        if (!enabled) {
            cancel();
        }
    }, [enabled, cancel]);
    useEffect(() => cancel, [cancel]);

    return { prime, onCleared, stop };
}
