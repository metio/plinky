// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Mastery, normalizeMastery } from "../../core/mastery";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createKeyedJsonStore, type KeyedJsonStore } from "./jsonStore";

// One entry per catalogue piece, keyed by score id: the single source of truth
// every view of a piece's mastery reads — the score's own badge, a MarkLearned
// button in a page header, the grade badge — so they re-render together when a
// finished run or a manual mark changes it. All the mechanics live in the shared
// keyed factory; this instantiation names the key family and the normalizer.
export type MasteryStore = KeyedJsonStore<Mastery>;

export function createMasteryStore(kv: KeyValueStore): MasteryStore {
    return createKeyedJsonStore(kv, "plinky:mastery:", normalizeMastery);
}
