// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
    const listeners = new Set<() => void>();
    const notify = () => {
        for (const listener of [...listeners]) {
            listener();
        }
    };
    return {
        begin() {
            count += 1;
            if (count === 1) {
                notify();
            }
            let ended = false;
            return () => {
                if (ended) {
                    return;
                }
                ended = true;
                count -= 1;
                if (count === 0) {
                    notify();
                }
            };
        },
        active: () => count > 0,
        subscribe(onChange) {
            listeners.add(onChange);
            return () => {
                listeners.delete(onChange);
            };
        },
    };
}

// The app-wide instance: the composition root (app/root.tsx) watches it to time
// reloads, and the default service set hands it to the screens that begin
// activities — one shared signal, so a run started anywhere holds the reload.
export const runActivity: ActivitySignal = createActivitySignal();
