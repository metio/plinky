// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Scheduler } from "../ports/scheduler";

// The real Scheduler: window timers, requestAnimationFrame, and performance.now.
// The one place these platform globals are named — the confined-globals check
// pins them here, so every other file schedules through the injected capability.
// cancel() clears both a timeout and an interval id (the platform keeps them in
// one table, so a stray clear on the wrong kind is a harmless no-op), which lets
// after() and every() share a single cancel without the caller tracking which.
export const browserScheduler: Scheduler = {
    after: (ms, run) => window.setTimeout(run, ms),
    every: (ms, run) => window.setInterval(run, ms),
    cancel: (handle) => {
        window.clearTimeout(handle);
        window.clearInterval(handle);
    },
    frame: (run) => window.requestAnimationFrame(run),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    now: () => performance.now(),
};
