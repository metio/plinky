// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { clampVolume, parsePrefs, type Prefs } from "../../core/prefs";
import type { KeyValueStore } from "../ports/keyValueStore";

const KEY = "plinky:prefs";

// The single source of truth for preferences: every reader gets the same snapshot,
// every save notifies every subscriber, so a toggle flipped on the Settings route
// re-renders each keyboard, score and badge that cares — no window-event bus.
export type PrefsStore = {
    // The current prefs. Stable: the same object comes back until a save (or an
    // external change) actually alters the stored value, which is what lets a React
    // subscription use it as a snapshot without re-render loops.
    load(): Prefs;
    // Persist and notify subscribers; returns whether the write actually landed.
    // A refused write (blocked storage, quota) notifies no one — subscribers only
    // hear about changes that are real.
    save(prefs: Prefs): boolean;
    subscribe(onChange: () => void): () => void;
};

// Builds a prefs store over any KeyValueStore — the browser adapter in the app,
// an in-memory fake in a test. The store owns parsing, snapshot caching and
// change notification; the backing store only holds the string.
export function createPrefsStore(kv: KeyValueStore): PrefsStore {
    const listeners = new Set<() => void>();
    let cachedRaw: string | null = null;
    let cached: Prefs | null = null;

    const load = (): Prefs => {
        const raw = kv.get(KEY);
        if (cached === null || raw !== cachedRaw) {
            cached = parsePrefs(raw);
            cachedRaw = raw;
        }
        return cached;
    };

    const notify = () => {
        for (const listener of [...listeners]) {
            listener();
        }
    };

    return {
        load,
        save(prefs) {
            const stored = kv.set(
                KEY,
                JSON.stringify({ ...prefs, volume: clampVolume(prefs.volume) }),
            );
            if (stored) {
                notify();
            }
            return stored;
        },
        subscribe(onChange) {
            listeners.add(onChange);
            // A change made in another tab arrives as the browser's storage event;
            // same-tab saves notify directly above.
            if (typeof window !== "undefined") {
                window.addEventListener("storage", onChange);
            }
            return () => {
                listeners.delete(onChange);
                if (typeof window !== "undefined") {
                    window.removeEventListener("storage", onChange);
                }
            };
        },
    };
}
