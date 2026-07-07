// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useRef } from "react";

export type TimerChain = {
    // Schedule the next link. A playback loop re-arms itself from inside its own
    // callback, chaining tick → tick until stopped.
    push(callback: () => void, delayMs: number): void;
    // Wind the chain down: every scheduled link is cancelled. Idempotent, so any
    // boundary (stop button, mode switch, layout reload, leaving full screen)
    // can clear without caring whether the chain is running.
    clear(): void;
};

// A self-cancelling setTimeout chain — the clock behind a cursor playback loop.
// Each mode owns its own chain, so stopping one can never cut down another's
// timers, and unmount clears whatever is still pending, so no loop outlives the
// surface that started it.
export function useTimerChain(): TimerChain {
    const ids = useRef<number[]>([]);
    const clear = useCallback(() => {
        for (const id of ids.current) {
            window.clearTimeout(id);
        }
        ids.current = [];
    }, []);
    const push = useCallback((callback: () => void, delayMs: number) => {
        ids.current.push(window.setTimeout(callback, delayMs));
    }, []);
    useEffect(() => clear, [clear]);
    return useMemo(() => ({ push, clear }), [push, clear]);
}
