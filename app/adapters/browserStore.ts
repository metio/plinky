// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";

// The one place the app touches `localStorage`. Merely *accessing* the global can throw
// a SecurityError — Firefox with site-data disabled, a sandboxed iframe — and a
// `typeof localStorage` check does not suppress it, so every access is wrapped in a
// try/catch here. This is the single denied-storage guard the whole app relies on: a
// read falls back to null, a write or remove becomes a no-op, and the page that called
// it keeps running instead of crashing. No other module references `localStorage`
// directly (enforced by dev/check-globals.mjs) — they go through this seam.
function guarded<T>(run: (store: Storage) => T, fallback: T): T {
    try {
        return run(localStorage);
    } catch {
        return fallback;
    }
}

export const browserStore: KeyValueStore = {
    get: (key) => guarded((store) => store.getItem(key), null),
    set: (key, value) =>
        guarded((store) => {
            store.setItem(key, value);
            return true;
        }, false),
    remove: (key) => {
        guarded((store) => store.removeItem(key), undefined);
    },
    keys: () => guarded((store) => Object.keys(store), []),
};
