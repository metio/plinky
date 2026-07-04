// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";

// The one JSON-over-KeyValueStore idiom, shared by every store: parse defensively,
// serialize with a boolean verdict, cache snapshots by the raw stored string so a
// React subscription gets a stable object until the value really changes, and
// notify subscribers only about writes that landed. Each concrete store (prefs,
// mastery, …) is a thin instantiation, so a caching or notification bug is fixed
// here once instead of once per store.

// Persist `value` as JSON; false when it cannot be serialized or the store
// refuses the write, so a caller that must know can react.
export function writeJson(kv: KeyValueStore, key: string, value: unknown): boolean {
    try {
        return kv.set(key, JSON.stringify(value));
    } catch {
        return false;
    }
}

type Listener = () => void;

// Same-tab notification plus cross-tab pickup: saves notify the local listeners
// directly; a change in another tab arrives as the browser's storage event,
// filtered by `matches` so a write to an unrelated key wakes nobody. A null
// event key means the whole store was cleared, which any key may be part of.
function createBus(matches: (key: string) => boolean) {
    const listeners = new Set<Listener>();
    return {
        notify() {
            for (const listener of [...listeners]) {
                listener();
            }
        },
        subscribe(onChange: Listener): () => void {
            listeners.add(onChange);
            const onStorage = (event: StorageEvent) => {
                if (event.key === null || matches(event.key)) {
                    onChange();
                }
            };
            if (typeof window !== "undefined") {
                window.addEventListener("storage", onStorage);
            }
            return () => {
                listeners.delete(onChange);
                if (typeof window !== "undefined") {
                    window.removeEventListener("storage", onStorage);
                }
            };
        },
    };
}

// A single value under one key — preferences, a theme, a flag.
export type JsonStore<T> = {
    // The current value. Stable: the same object comes back until the stored
    // value changes, which lets a React subscription use it as a snapshot
    // without re-render loops.
    load(): T;
    // Persist and notify subscribers; returns whether the write landed. A
    // refused write notifies no one — subscribers only hear about real changes.
    save(value: T): boolean;
    subscribe(onChange: Listener): () => void;
};

export function createJsonStore<T>(
    kv: KeyValueStore,
    key: string,
    // Turns the raw stored string (or null for nothing stored) into a full,
    // valid value — the store never hands out unvalidated data.
    parse: (raw: string | null) => T,
    // Optional shape adjustment on the way in (clamping, trimming).
    serialize: (value: T) => unknown = (value) => value,
): JsonStore<T> {
    const bus = createBus((changed) => changed === key);
    let cachedRaw: string | null = null;
    let cached: T | null = null;

    return {
        load() {
            const raw = kv.get(key);
            if (cached === null || raw !== cachedRaw) {
                cached = parse(raw);
                cachedRaw = raw;
            }
            return cached;
        },
        save(value) {
            const stored = writeJson(kv, key, serialize(value));
            if (stored) {
                bus.notify();
            }
            return stored;
        },
        subscribe: bus.subscribe,
    };
}

// A family of values under a common key prefix — one entry per catalogue piece.
export type KeyedJsonStore<T> = {
    // The entry for `id`, or null when absent or corrupt. Stable per id, like
    // JsonStore.load.
    load(id: string): T | null;
    save(id: string, value: T): boolean;
    remove(id: string): void;
    // Every stored entry, for the selectors that aggregate across the family.
    loadAll(): Array<{ id: string; value: T }>;
    subscribe(onChange: Listener): () => void;
};

export function createKeyedJsonStore<T>(
    kv: KeyValueStore,
    prefix: string,
    // Coerces a parsed (possibly legacy or corrupt) entry into a full value.
    normalize: (raw: unknown) => T,
): KeyedJsonStore<T> {
    const bus = createBus((changed) => changed.startsWith(prefix));
    const cache = new Map<string, { raw: string; value: T }>();

    const load = (id: string): T | null => {
        const raw = kv.get(prefix + id);
        if (raw === null) {
            cache.delete(id);
            return null;
        }
        const hit = cache.get(id);
        if (hit && hit.raw === raw) {
            return hit.value;
        }
        try {
            const value = normalize(JSON.parse(raw));
            cache.set(id, { raw, value });
            return value;
        } catch {
            // A corrupt entry reads as missing rather than crashing the caller.
            return null;
        }
    };

    return {
        load,
        save(id, value) {
            const stored = writeJson(kv, prefix + id, value);
            if (stored) {
                bus.notify();
            }
            return stored;
        },
        remove(id) {
            kv.remove(prefix + id);
            cache.delete(id);
            bus.notify();
        },
        loadAll() {
            const out: Array<{ id: string; value: T }> = [];
            for (const key of kv.keys()) {
                if (!key.startsWith(prefix)) {
                    continue;
                }
                const id = key.slice(prefix.length);
                const value = load(id);
                if (value !== null) {
                    out.push({ id, value });
                }
            }
            return out;
        },
        subscribe: bus.subscribe,
    };
}
