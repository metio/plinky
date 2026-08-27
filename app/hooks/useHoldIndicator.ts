// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLatest } from "./useLatest";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { beginHold, type Hold, holdFractionsByNote, pruneHolds } from "../../core/holds";
import { useScheduler } from "../contexts/services";
import type { SchedulerHandle } from "../ports/scheduler";

const EMPTY: ReadonlyMap<number, number> = new Map();

// The fills, as something to subscribe to rather than something to hold.
//
// `feed` is one stable object for the life of the hook, so putting it in a context
// changes that context never. Only the component that actually paints the keys
// subscribes, and only that component re-renders when a fill moves.
export type HoldFeed = {
    subscribe(onChange: () => void): () => void;
    // The current fraction per note. Returns the same map until a frame changes it, so
    // useSyncExternalStore can use it as a snapshot without looping.
    get(): ReadonlyMap<number, number>;
};

// Animates the on-screen keyboard's hold-duration fill. When a note is played
// correctly the caller calls `begin` with its written length; this drives a
// per-frame shrink of that note's fill through the injected Scheduler and publishes
// the current remaining-fraction-per-note map for rendering. The pure hold
// bookkeeping lives in core/holds; this hook only owns the clock and the
// subscription. Frames run only while a hold is live — the loop stops re-arming once
// every fill has emptied.
//
// Published rather than returned as state on purpose. React state here re-rendered
// whoever called the hook, which was the play session — and the session's value is
// read by every panel on the surface, so one held note repainted the entire play tree
// sixty times a second. The fills are wanted by exactly one component, and this is how
// it gets them without the other twenty hearing about it.
export function useHoldIndicator(): {
    holds: HoldFeed;
    begin: (holds: Iterable<{ note: number; durationMs: number }>) => void;
    clear: () => void;
} {
    const scheduler = useScheduler();
    const schedulerRef = useLatest(scheduler);

    const fractionsRef = useRef<ReadonlyMap<number, number>>(EMPTY);
    const listenersRef = useRef(new Set<() => void>());
    const holdsRef = useRef<Hold[]>([]);
    const frameRef = useRef<SchedulerHandle | null>(null);

    const publish = useCallback((next: ReadonlyMap<number, number>) => {
        // Identity is the snapshot's whole contract, so an empty map that is already
        // empty must not become a new one — a subscriber would re-render forever.
        if (next.size === 0 && fractionsRef.current.size === 0) {
            return;
        }
        fractionsRef.current = next;
        for (const listener of listenersRef.current) {
            listener();
        }
    }, []);

    const feed = useMemo<HoldFeed>(
        () => ({
            subscribe(onChange) {
                listenersRef.current.add(onChange);
                return () => {
                    listenersRef.current.delete(onChange);
                };
            },
            get: () => fractionsRef.current,
        }),
        [],
    );

    const stopFrame = useCallback(() => {
        if (frameRef.current !== null) {
            schedulerRef.current.cancelFrame(frameRef.current);
            frameRef.current = null;
        }
    }, []);

    const tick = useCallback(() => {
        const now = schedulerRef.current.now();
        holdsRef.current = pruneHolds(holdsRef.current, now);
        publish(holdFractionsByNote(holdsRef.current, now));
        // Re-arm only while something is still shrinking, so an idle keyboard costs
        // no frames.
        frameRef.current = holdsRef.current.length > 0 ? schedulerRef.current.frame(tick) : null;
    }, [publish]);

    const begin = useCallback(
        (holds: Iterable<{ note: number; durationMs: number }>) => {
            const now = schedulerRef.current.now();
            let armed = false;
            // Each key carries its own written length: two hands rarely hold for the
            // same time, and one figure for the whole position drains a quaver's fill
            // at the whole note's pace beside it.
            for (const { note, durationMs } of holds) {
                if (!(durationMs > 0)) {
                    continue;
                }
                holdsRef.current = beginHold(holdsRef.current, note, now, durationMs);
                armed = true;
            }
            if (!armed) {
                return;
            }
            publish(holdFractionsByNote(holdsRef.current, now));
            if (frameRef.current === null) {
                frameRef.current = schedulerRef.current.frame(tick);
            }
        },
        [tick, publish],
    );

    const clear = useCallback(() => {
        holdsRef.current = [];
        stopFrame();
        publish(EMPTY);
    }, [stopFrame, publish]);

    // A run torn down mid-hold leaves a frame armed; cancel it on unmount.
    useEffect(() => stopFrame, [stopFrame]);

    return { holds: feed, begin, clear };
}
