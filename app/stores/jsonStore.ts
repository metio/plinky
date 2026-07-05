// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";

// The one JSON-over-KeyValueStore idiom, shared by every store: parse defensively,
// serialize with a boolean verdict, cache snapshots by the raw stored string so a
// React subscription gets a stable object until the value really changes, and
// notify subscribers only about writes that landed. Each concrete store (prefs,
// mastery, …) is a thin instantiation, so a caching or notification bug is fixed
// here once instead of once per store.

// The parsed value stored under `key`, or null when absent or corrupt — corrupt
// data reads as missing rather than crashing the caller. The caller validates the
// shape, so this is where the storage helpers get their read half without each
// re-implementing the get-and-parse guard.
export function readJson(kv: KeyValueStore, key: string): unknown {
    const raw = kv.get(key);
    if (raw === null) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

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
    // One broken subscriber must not silence the rest — every listener hears
    // about a change, whatever its peers do. Applies to both delivery paths:
    // the same-tab notify loop and the cross-tab storage handler.
    const safely = (listener: Listener) => {
        try {
            listener();
        } catch {
            // The subscriber's failure is its own; delivery continues.
        }
    };
    return {
        notify() {
            for (const listener of [...listeners]) {
                safely(listener);
            }
        },
        subscribe(onChange: Listener): () => void {
            listeners.add(onChange);
            const onStorage = (event: StorageEvent) => {
                if (event.key === null || matches(event.key)) {
                    safely(onChange);
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
            const raw = toRaw(serialize(value));
            if (raw === null) {
                return false;
            }
            // A value identical to what's stored needs no write and no
            // announcement — an idempotent save must not wake every subscriber.
            if (raw === kv.get(key)) {
                return true;
            }
            const stored = setRaw(kv, key, raw);
            if (stored) {
                // Prime the snapshot from the just-written raw so the next
                // load() is a cache hit rather than a reparse.
                cached = parse(raw);
                cachedRaw = raw;
                bus.notify();
            }
            return stored;
        },
        subscribe: bus.subscribe,
    };
}

// The serialized form of `value`, or null when it cannot be represented as a
// JSON string (a cycle, a bare undefined).
function toRaw(value: unknown): string | null {
    try {
        const raw = JSON.stringify(value);
        return typeof raw === "string" ? raw : null;
    } catch {
        return null;
    }
}

// Write an already-serialized string, false when the store refuses.
function setRaw(kv: KeyValueStore, key: string, raw: string): boolean {
    try {
        return kv.set(key, raw);
    } catch {
        return false;
    }
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
            const raw = toRaw(value);
            if (raw === null) {
                return false;
            }
            // Same dedupe as the single-value store: an identical entry means
            // no write, no cache churn, and no subscriber wakeup.
            if (raw === kv.get(prefix + id)) {
                return true;
            }
            const stored = setRaw(kv, prefix + id, raw);
            if (stored) {
                cache.delete(id);
                bus.notify();
            }
            return stored;
        },
        remove(id) {
            // Removing what isn't there changes nothing, so nobody is told.
            if (kv.get(prefix + id) === null) {
                return;
            }
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
