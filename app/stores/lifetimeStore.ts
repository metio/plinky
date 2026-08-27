// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { foldRun, type Lifetime, normalizeLifetime, type Skill } from "../../core/lifetime";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, parseJson } from "./jsonStore";

// The slow-moving skill fingerprint (see core/lifetime): persisted per device,
// folded on every finished run, read by the You page's progress grid.

const KEY = "plinky:lifetime";

export type LifetimeStore = {
    load(): Lifetime;
    // Fold a finished run into the fingerprint and persist it, returning whether it
    // landed. The fingerprint itself is not returned: every reader reaches it through
    // load() under a subscription, and handing back the new value while staying silent
    // about whether it was stored is the wrong half to report.
    recordRun(run: Skill, now?: Date): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createLifetimeStore(kv: KeyValueStore): LifetimeStore {
    const store = createJsonStore<Lifetime>(kv, KEY, (raw) =>
        parseJson(raw, { days: [] }, normalizeLifetime),
    );
    return {
        load: store.load,
        recordRun(run, now = new Date()) {
            return store.save(foldRun(store.load(), run, now));
        },
        subscribe: store.subscribe,
    };
}
