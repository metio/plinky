// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mergeBest, normalizeBest } from "../../core/sectionBest";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createKeyedJsonStore } from "./jsonStore";

// The best each section of a piece has ever been played, one record per piece.

export type SectionBestStore = {
    load(scoreId: string): number[] | null;
    // Fold a run's section scores in, keeping whichever reading of each went better,
    // and report whether the merged record landed. The record itself is read back
    // through load() by the one panel that shows it.
    record(scoreId: string, run: number[]): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createSectionBestStore(kv: KeyValueStore): SectionBestStore {
    const store = createKeyedJsonStore<number[] | null>(kv, "plinky:sectionbest:", normalizeBest);
    return {
        load: (scoreId) => store.load(scoreId),
        record(scoreId, run) {
            return store.save(scoreId, mergeBest(store.load(scoreId), run));
        },
        subscribe: store.subscribe,
    };
}
