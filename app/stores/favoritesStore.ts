// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore } from "./jsonStore";

// The scores a user has starred, kept on the device. One source of truth over
// the injected store: the library list subscribes to it, first-run seeding
// writes through it, and the home page reads the same set — so starring in one
// place updates every other without a hand-mirrored copy.

const KEY = "plinky:favorites";

export type FavoritesStore = {
    // The starred ids. Stable: the same Set comes back until it changes, so a
    // React subscription can use it as a snapshot.
    load(): ReadonlySet<string>;
    has(id: string): boolean;
    // Flip a score's starred state; false when the write is refused.
    toggle(id: string): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createFavoritesStore(kv: KeyValueStore): FavoritesStore {
    const store = createJsonStore<ReadonlySet<string>>(
        kv,
        KEY,
        (raw) => {
            if (raw === null) {
                return new Set();
            }
            try {
                const parsed: unknown = JSON.parse(raw);
                return new Set(
                    Array.isArray(parsed)
                        ? parsed.filter((id): id is string => typeof id === "string")
                        : [],
                );
            } catch {
                return new Set();
            }
        },
        (value) => [...value],
    );
    return {
        load: store.load,
        has: (id) => store.load().has(id),
        toggle(id) {
            const next = new Set(store.load());
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return store.save(next);
        },
        subscribe: store.subscribe,
    };
}
