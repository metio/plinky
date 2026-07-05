// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";
import { createKeyedJsonStore } from "./jsonStore";

// The stored ghosts: per score, the onset times of a run to race against (see
// core/ghost for the codec and race arithmetic). One entry per score — the
// fastest own run, or a friend's adopted from a share link.

export type GhostStore = {
    // The stored ghost's onsets, or null when there is none worth racing.
    load(scoreId: string): number[] | null;
    save(scoreId: string, onsets: number[]): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createGhostStore(kv: KeyValueStore): GhostStore {
    const store = createKeyedJsonStore<number[]>(kv, "plinky:ghost:", (raw) =>
        Array.isArray(raw) ? raw.filter((onset): onset is number => typeof onset === "number") : [],
    );
    return {
        load(scoreId) {
            const onsets = store.load(scoreId);
            return onsets && onsets.length > 0 ? onsets : null;
        },
        save: (scoreId, onsets) => store.save(scoreId, onsets),
        subscribe: store.subscribe,
    };
}
