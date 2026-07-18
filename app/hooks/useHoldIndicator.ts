// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import { beginHold, type Hold, holdFractionsByNote, pruneHolds } from "../../core/holds";
import { useScheduler } from "../contexts/services";
import type { SchedulerHandle } from "../ports/scheduler";

const EMPTY: ReadonlyMap<number, number> = new Map();

// Animates the on-screen keyboard's hold-duration fill. When a note is played
// correctly the caller calls `begin` with its written length; this drives a
// per-frame shrink of that note's fill through the injected Scheduler and hands
// the current remaining-fraction-per-note map back for rendering. The pure hold
// bookkeeping lives in core/holds; this hook only owns the clock and the React
// state. Frames run only while a hold is live — the loop stops re-arming once
// every fill has emptied.
export function useHoldIndicator(): {
    holdFractions: ReadonlyMap<number, number>;
    begin: (notes: Iterable<number>, durationMs: number) => void;
    clear: () => void;
} {
    const scheduler = useScheduler();
    const schedulerRef = useRef(scheduler);
    schedulerRef.current = scheduler;

    const [holdFractions, setHoldFractions] = useState<ReadonlyMap<number, number>>(EMPTY);
    const holdsRef = useRef<Hold[]>([]);
    const frameRef = useRef<SchedulerHandle | null>(null);

    const stopFrame = useCallback(() => {
        if (frameRef.current !== null) {
            schedulerRef.current.cancelFrame(frameRef.current);
            frameRef.current = null;
        }
    }, []);

    const tick = useCallback(() => {
        const now = schedulerRef.current.now();
        holdsRef.current = pruneHolds(holdsRef.current, now);
        setHoldFractions(holdFractionsByNote(holdsRef.current, now));
        // Re-arm only while something is still shrinking, so an idle keyboard costs
        // no frames.
        frameRef.current = holdsRef.current.length > 0 ? schedulerRef.current.frame(tick) : null;
    }, []);

    const begin = useCallback(
        (notes: Iterable<number>, durationMs: number) => {
            if (!(durationMs > 0)) {
                return;
            }
            const now = schedulerRef.current.now();
            for (const note of notes) {
                holdsRef.current = beginHold(holdsRef.current, note, now, durationMs);
            }
            setHoldFractions(holdFractionsByNote(holdsRef.current, now));
            if (frameRef.current === null) {
                frameRef.current = schedulerRef.current.frame(tick);
            }
        },
        [tick],
    );

    const clear = useCallback(() => {
        holdsRef.current = [];
        stopFrame();
        setHoldFractions(EMPTY);
    }, [stopFrame]);

    // A run torn down mid-hold leaves a frame armed; cancel it on unmount.
    useEffect(() => stopFrame, [stopFrame]);

    return { holdFractions, begin, clear };
}
