// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {
    MAX_TAKES_PER_SONG,
    type StoredTake,
    type Take,
    takeFromStored,
    takeToStored,
} from "../../core/takes";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createKeyedJsonStore } from "./jsonStore";

// The saved takes, per song (see core/takes for the take model and codecs).

// A mutation's outcome: the list as storage now actually holds it, plus whether
// the write landed — so a caller can render the truth and say when it didn't.
export type TakesResult = { takes: Take[]; stored: boolean };

export type TakesStore = {
    list(songId: string): Take[];
    // Add a take, newest first, keeping at most MAX_TAKES_PER_SONG (oldest
    // dropped). A failed write leaves storage as it was, so the result then
    // re-reads the real list rather than an optimistic one the next reload
    // would contradict.
    save(songId: string, take: Take): TakesResult;
    // Remove a take by id. On a failed rewrite the take is still in storage,
    // and the returned list says so instead of pretending it is gone.
    remove(songId: string, takeId: string): TakesResult;
    subscribe(onChange: () => void): () => void;
};

export function createTakesStore(kv: KeyValueStore): TakesStore {
    const store = createKeyedJsonStore<StoredTake[]>(kv, "plinky:takes:", (raw) =>
        Array.isArray(raw) ? (raw as StoredTake[]) : [],
    );

    const list = (songId: string): Take[] =>
        (store.load(songId) ?? [])
            .map(takeFromStored)
            .filter((take): take is Take => take !== null);

    const persist = (songId: string, takes: Take[]): boolean => {
        try {
            return store.save(songId, takes.map(takeToStored));
        } catch {
            // A take that cannot be encoded never reaches the store.
            return false;
        }
    };

    return {
        list,
        save(songId, take) {
            const next = [take, ...list(songId).filter((other) => other.id !== take.id)].slice(
                0,
                MAX_TAKES_PER_SONG,
            );
            const stored = persist(songId, next);
            return { takes: stored ? next : list(songId), stored };
        },
        remove(songId, takeId) {
            const next = list(songId).filter((take) => take.id !== takeId);
            const stored = persist(songId, next);
            return { takes: stored ? next : list(songId), stored };
        },
        subscribe: store.subscribe,
    };
}
