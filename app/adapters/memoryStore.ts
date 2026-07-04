// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";

// An in-memory KeyValueStore for tests: give a unit this instead of the browser
// adapter and its persistence is a plain Map you can seed and inspect, with no
// jsdom, no global stubbing, and no cross-test leakage. Seed it with initial
// contents to stand in for a store that already holds prior state.
export function memoryStore(seed: Record<string, string> = {}): KeyValueStore {
    const map = new Map<string, string>(Object.entries(seed));
    return {
        get: (key) => (map.has(key) ? (map.get(key) ?? null) : null),
        set: (key, value) => {
            map.set(key, value);
            return true;
        },
        remove: (key) => {
            map.delete(key);
        },
        keys: () => [...map.keys()],
    };
}
