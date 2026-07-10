// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type DiscoveryId, MARKABLE } from "../../core/onboarding";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createStringSetStore } from "./jsonStore";

// The markable half of the discovery checklist: which try-it-once features the
// player has reached. The derived steps read real state elsewhere; this store
// only remembers the ones that leave no other trace.

const KEY = "plinky:discovered";

export type OnboardingStore = {
    marked(): ReadonlySet<DiscoveryId>;
    // Record reaching a markable feature. A no-op for derived steps, whose
    // completion is read from real state instead.
    markDiscovered(id: DiscoveryId): void;
    subscribe(onChange: () => void): () => void;
};

export function createOnboardingStore(kv: KeyValueStore): OnboardingStore {
    const store = createStringSetStore(kv, KEY, (id): id is DiscoveryId =>
        MARKABLE.includes(id as DiscoveryId),
    );
    return {
        marked: store.load,
        markDiscovered(id) {
            if (!MARKABLE.includes(id) || store.load().has(id)) {
                return;
            }
            store.save(new Set([...store.load(), id]));
        },
        subscribe: store.subscribe,
    };
}
