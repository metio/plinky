// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { foldRun, type Lifetime, normalizeLifetime, type Skill } from "../../core/lifetime";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, parseJson } from "./jsonStore";

// The slow-moving skill fingerprint (see core/lifetime): persisted per device,
// folded on every finished run, read by the You page's progress grid.

const KEY = "plinky:lifetime";

export type LifetimeStore = {
    load(): Lifetime;
    // Fold a finished run into the fingerprint and persist it. Returns the
    // updated lifetime for immediate rendering; a refused write surfaces
    // through the storage banner.
    recordRun(run: Skill, now?: Date): Lifetime;
    subscribe(onChange: () => void): () => void;
};

export function createLifetimeStore(kv: KeyValueStore): LifetimeStore {
    const store = createJsonStore<Lifetime>(kv, KEY, (raw) =>
        parseJson(raw, { days: [] }, normalizeLifetime),
    );
    return {
        load: store.load,
        recordRun(run, now = new Date()) {
            const next = foldRun(store.load(), run, now);
            store.save(next);
            return next;
        },
        subscribe: store.subscribe,
    };
}
