// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { memoryStore } from "../adapters/memoryStore";
import type { KeyValueStore } from "../ports/keyValueStore";

// Characters a store holds, keys included — what a browser counts against a
// localStorage quota.
export function sizeOf(kv: KeyValueStore): number {
    return kv.keys().reduce((sum, key) => sum + key.length + (kv.get(key) ?? "").length, 0);
}

// Every key the store holds with its value, for comparing a whole device before and after.
export function snapshotOf(kv: KeyValueStore): Record<string, string | null> {
    return Object.fromEntries(kv.keys().map((key) => [key, kv.get(key)]));
}

// A device with room for `capacity` characters, keys included, which refuses any write
// that would take it past that. Removing a value frees its room for the next write,
// the way a real quota behaves. The seed is taken as given, so a test can start from a
// device that is already full.
export function quotaStore(seed: Record<string, string>, capacity: number): KeyValueStore {
    const inner = memoryStore(seed);
    return {
        ...inner,
        set: (key, value) => {
            const current = inner.get(key);
            const freed = current === null ? 0 : key.length + current.length;
            return sizeOf(inner) - freed + key.length + value.length <= capacity
                ? inner.set(key, value)
                : false;
        },
    };
}
