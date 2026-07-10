// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";
import { createStringSetStore } from "./jsonStore";

// Which one-time coaching hints the player has already seen or dismissed, so each
// shows at most once. A plain per-device set under one key — cleared by the
// Settings reset.

const KEY = "plinky:seen-hints";

export type HintsStore = {
    seen(id: string): boolean;
    // Remember a hint as seen; false when the write is refused.
    markSeen(id: string): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createHintsStore(kv: KeyValueStore): HintsStore {
    const store = createStringSetStore(kv, KEY);
    return {
        seen: (id) => store.load().has(id),
        markSeen(id) {
            const current = store.load();
            if (current.has(id)) {
                return true;
            }
            return store.save(new Set([...current, id]));
        },
        subscribe: store.subscribe,
    };
}
