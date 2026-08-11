// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, parseJson } from "./jsonStore";

// The last placement test's result. One entry, not a history: the question it
// answers is "where do I start", and the answer is the most recent one — a reader
// who has moved on re-takes it rather than reading a list of who they used to be.

export type PlacementResult = {
    rating: number;
    grade: number;
    takenAt: number;
};

export type PlacementStore = {
    load(): PlacementResult | null;
    save(result: PlacementResult): boolean;
    clear(): boolean;
    subscribe(onChange: () => void): () => void;
};

function normalize(raw: unknown): PlacementResult | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const value = raw as Record<string, unknown>;
    if (
        !Number.isFinite(value.rating) ||
        !Number.isFinite(value.grade) ||
        !Number.isFinite(value.takenAt)
    ) {
        return null;
    }
    return {
        rating: value.rating as number,
        grade: value.grade as number,
        takenAt: value.takenAt as number,
    };
}

export function createPlacementStore(kv: KeyValueStore): PlacementStore {
    const store = createJsonStore<PlacementResult | null>(kv, "plinky:placement", (raw) =>
        parseJson(raw, null, normalize),
    );
    return {
        load: store.load,
        save: (result) => store.save(result),
        clear: () => store.save(null),
        subscribe: store.subscribe,
    };
}
