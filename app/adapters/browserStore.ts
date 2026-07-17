// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createEmitter } from "../../core/emitter";
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

// The aggregate "is this device persisting writes?" signal the storage banner
// subscribes to. failed() latches: a device that refused one write has told us
// what we need to know, and un-latching would flicker the banner off the moment
// an unrelated write happened to land.
export type BrowserStorageHealth = {
    failed(): boolean;
    subscribe(listener: () => void): () => void;
};

// A store and the health latch fed by its own writes — one pair, created
// together, because the latch is only meaningful for the writes it observed.
// Each call yields an independent pair; the app instantiates exactly one below.
export function createBrowserStore(): { store: KeyValueStore; health: BrowserStorageHealth } {
    // Flips on the first refused write (quota exceeded, storage denied) and
    // stays on, so a failure anywhere surfaces once instead of every save site
    // growing its own warning. Individual callers still get the boolean verdict
    // per write; this is the aggregate signal.
    let writeFailed = false;
    const healthEmitter = createEmitter();

    const markWriteFailed = (): void => {
        if (writeFailed) {
            return;
        }
        writeFailed = true;
        healthEmitter.notify();
    };

    // A refused write is a signal, not a circuit breaker: every operation keeps
    // attempting the real storage afterwards, because the condition that
    // refused it (a full quota, a denied context) can lift.
    const store: KeyValueStore = {
        get: (key) => guarded((backing) => backing.getItem(key), null),
        set: (key, value) => {
            const stored = guarded((backing) => {
                backing.setItem(key, value);
                return true;
            }, false);
            if (!stored) {
                markWriteFailed();
            }
            return stored;
        },
        remove: (key) => {
            const removed = guarded((backing) => {
                backing.removeItem(key);
                return true;
            }, false);
            if (!removed) {
                markWriteFailed();
            }
        },
        keys: () => guarded((backing) => Object.keys(backing), []),
    };

    return {
        store,
        health: { failed: () => writeFailed, subscribe: healthEmitter.subscribe },
    };
}

// The app's one browser-backed store. Both composition roots read the same
// instance — services.tsx hands the store to every feature, root.tsx hands the
// health to the banner — so the banner reflects the writes the app actually
// made.
export const { store: browserStore, health: storageHealth } = createBrowserStore();
