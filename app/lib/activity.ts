// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createEmitter } from "../../core/emitter";

// A counting "something is in progress" signal. A practice run begins an
// activity and ends it when the run finishes or unmounts; the composition root
// reads it to hold a service-worker reload until the player is between runs.
// Counting, not boolean: overlapping activities (however unlikely) must all end
// before the app counts as idle.

export type ActivitySignal = {
    // Marks an activity as running; the returned function ends it. Idempotent —
    // calling the end twice releases only once, so an effect cleanup can't
    // underflow the count.
    begin(): () => void;
    active(): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createActivitySignal(): ActivitySignal {
    let count = 0;
    const emitter = createEmitter();
    return {
        begin() {
            count += 1;
            if (count === 1) {
                emitter.notify();
            }
            let ended = false;
            return () => {
                if (ended) {
                    return;
                }
                ended = true;
                count -= 1;
                if (count === 0) {
                    emitter.notify();
                }
            };
        },
        active: () => count > 0,
        subscribe: emitter.subscribe,
    };
}

// Holds the signal for exactly as long as `work` runs, success or failure — for an
// async job (an export) whose unsaved result a reload would throw away. The hold is
// taken before the first await and released in a finally, so a throw, a synchronous
// one included, cannot leave the app counting as busy for the rest of the session.
//
// It is tied to the work, not to a component: a job whose button unmounts keeps
// running and still delivers its file, so the reload waits for it rather than for the
// button.
//
// A job that never settles therefore holds the reload until the tab closes. There is no
// ceiling on purpose: a long take legitimately encodes for minutes, and any cut-off short
// of that would reload a file away. What ends a broken job is its own failure path, which
// is why the exporters fail an encode on the encoder's error callback rather than waiting
// on a flush that may never come.
export async function holdWhile<T>(signal: ActivitySignal, work: () => Promise<T>): Promise<T> {
    const end = signal.begin();
    try {
        return await work();
    } finally {
        end();
    }
}

// The app-wide instance: the composition root (app/root.tsx) watches it to time
// reloads, and the default service set hands it to the screens that begin
// activities — one shared signal, so a run started anywhere holds the reload.
export const runActivity: ActivitySignal = createActivitySignal();
