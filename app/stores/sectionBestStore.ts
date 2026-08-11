// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mergeBest, normalizeBest } from "../../core/sectionBest";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createKeyedJsonStore } from "./jsonStore";

// The best each section of a piece has ever been played, one record per piece.

export type SectionBestStore = {
    load(scoreId: string): number[] | null;
    // Fold a run's section scores in, keeping whichever reading of each went better.
    // Returns the record as it now stands, so a caller can report what changed
    // without reading back.
    record(scoreId: string, run: number[]): number[];
    subscribe(onChange: () => void): () => void;
};

export function createSectionBestStore(kv: KeyValueStore): SectionBestStore {
    const store = createKeyedJsonStore<number[] | null>(kv, "plinky:sectionbest:", normalizeBest);
    return {
        load: (scoreId) => store.load(scoreId),
        record(scoreId, run) {
            const merged = mergeBest(store.load(scoreId), run);
            store.save(scoreId, merged);
            return merged;
        },
        subscribe: store.subscribe,
    };
}
