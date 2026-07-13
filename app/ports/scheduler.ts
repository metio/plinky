// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The time seam: everything that schedules future work — a revert timer, a
// playback chain, a metronome pulse, an animation frame — asks the Scheduler
// instead of reaching for window.setTimeout. The real adapter wraps the
// platform; a test injects a fake with a virtual clock and drives time by hand,
// deterministically, in jsdom AND in a real browser (where vi.useFakeTimers
// can't freeze the event loop). That determinism is the whole point of the seam.
//
// The method names deliberately do NOT mirror the globals (setTimeout, …): the
// confined-globals check matches those bare words, so a `scheduler.setTimeout`
// call would trip it. Domain names keep the raw globals confined to the one
// adapter that owns them.

// An opaque scheduling handle. It is a number under the browser adapter, but
// callers only ever hand it back to cancel — never do arithmetic on it.
export type SchedulerHandle = number;

export interface Scheduler {
    // Run `run` once after `ms` milliseconds. Cancel with cancel().
    after(ms: number, run: () => void): SchedulerHandle;
    // Run `run` every `ms` milliseconds until cancelled. Cancel with cancel().
    every(ms: number, run: () => void): SchedulerHandle;
    // Cancel a pending after() or every(). Idempotent — cancelling an already-
    // fired or unknown handle is a no-op.
    cancel(handle: SchedulerHandle): void;
    // Run `run` on the next animation frame, passed the frame's timestamp (the
    // same value now() would return then). Cancel with cancelFrame().
    frame(run: (timeMs: number) => void): SchedulerHandle;
    cancelFrame(handle: SchedulerHandle): void;
    // The current time in milliseconds on a monotonic clock (performance.now
    // under the adapter, the virtual clock under the fake).
    now(): number;
}
