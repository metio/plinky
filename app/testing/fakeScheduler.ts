// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Scheduler, SchedulerHandle } from "../ports/scheduler";

// A Scheduler with a virtual clock the test winds by hand: no real timers, no
// vi.useFakeTimers (which can't freeze a real browser's event loop), so a
// time-based path is driven deterministically in jsdom AND in the browser
// projects. `advance(ms)` moves the clock and fires everything due along the
// way — including an interval's repeats and any timer a fired callback schedules
// — so a self-re-arming loop unwinds exactly as it would in real time, only
// instantly and in order.
export type FakeScheduler = Scheduler & {
    // Move the clock forward `ms`, firing every timer due in that span in time
    // order (intervals repeat; timers scheduled mid-advance fire if they fall
    // within the span). Lands the clock exactly `ms` later.
    advance(ms: number): void;
    // Fire the animation frames pending right now, each passed the current clock.
    // A frame that schedules another frame does NOT run this round (mirroring the
    // browser: one batch per paint) — call again to run the next.
    runFrames(): void;
    // How many timers and frames are currently scheduled — for asserting cleanup.
    pending(): { timers: number; frames: number };
};

type Timer = {
    handle: SchedulerHandle;
    dueAt: number;
    // The repeat period for an every(); undefined for a one-shot after().
    everyMs?: number;
    run: () => void;
};

export function fakeScheduler(startMs = 0): FakeScheduler {
    let clock = startMs;
    let nextHandle = 1;
    const timers = new Map<SchedulerHandle, Timer>();
    let frames: Array<{ handle: SchedulerHandle; run: (timeMs: number) => void }> = [];

    return {
        after(ms, run) {
            const handle = nextHandle++;
            timers.set(handle, { handle, dueAt: clock + Math.max(0, ms), run });
            return handle;
        },
        every(ms, run) {
            const handle = nextHandle++;
            const period = Math.max(1, ms);
            timers.set(handle, { handle, dueAt: clock + period, everyMs: period, run });
            return handle;
        },
        cancel(handle) {
            timers.delete(handle);
        },
        frame(run) {
            const handle = nextHandle++;
            frames.push({ handle, run });
            return handle;
        },
        cancelFrame(handle) {
            frames = frames.filter((frame) => frame.handle !== handle);
        },
        now: () => clock,

        advance(ms) {
            const target = clock + ms;
            // Repeatedly fire the earliest due timer until none is due at or before
            // the target — so a callback that schedules a nearer timer still fires
            // this advance, and an interval repeats across the whole span.
            for (;;) {
                let earliest: Timer | undefined;
                for (const timer of timers.values()) {
                    if (timer.dueAt <= target && (!earliest || timer.dueAt < earliest.dueAt)) {
                        earliest = timer;
                    }
                }
                if (!earliest) {
                    break;
                }
                clock = earliest.dueAt;
                if (earliest.everyMs === undefined) {
                    timers.delete(earliest.handle);
                } else {
                    earliest.dueAt += earliest.everyMs;
                }
                earliest.run();
            }
            clock = target;
        },

        runFrames() {
            const batch = frames;
            frames = [];
            for (const frame of batch) {
                frame.run(clock);
            }
        },

        pending: () => ({ timers: timers.size, frames: frames.length }),
    };
}
