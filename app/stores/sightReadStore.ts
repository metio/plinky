// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { firstRead, normalizeSightRead, type SightReadRecord } from "../../core/sightRead";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createKeyedJsonStore } from "./jsonStore";

// One remembered sight-read per score: how the piece went the first time it was
// ever read cold. Kept apart from mastery, which tracks the best a piece has ever
// been played — the opposite measurement.

export type SightReadStore = {
    load(scoreId: string): SightReadRecord | null;
    // Remember a sight-read. A score already read keeps its first record and the
    // write is reported as landed, since nothing needed saving — the caller is
    // telling us about a re-read, not failing to store one.
    record(scoreId: string, read: SightReadRecord): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createSightReadStore(kv: KeyValueStore): SightReadStore {
    const store = createKeyedJsonStore<SightReadRecord | null>(
        kv,
        "plinky:sightread:",
        normalizeSightRead,
    );
    return {
        load: (scoreId) => store.load(scoreId),
        record(scoreId, read) {
            const current = store.load(scoreId);
            if (current) {
                return true;
            }
            return store.save(scoreId, firstRead(current, read));
        },
        subscribe: store.subscribe,
    };
}
