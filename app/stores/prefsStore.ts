// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { clampVolume, parsePrefs, type Prefs } from "../../core/prefs";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, type JsonStore } from "./jsonStore";

// The single source of truth for preferences: every reader gets the same snapshot,
// every landed save notifies every subscriber, so a toggle flipped on the Settings
// route re-renders each keyboard, score and badge that cares. All the store
// mechanics live in the shared jsonStore factory; this instantiation only names
// the key, the validator and the write-time volume clamp. The page's language supplies
// the defaults a device that has chosen nothing reads — how its keys name a note.
export type PrefsStore = JsonStore<Prefs>;

export function createPrefsStore(kv: KeyValueStore, locale = "en"): PrefsStore {
    return createJsonStore(
        kv,
        "plinky:prefs",
        (raw) => parsePrefs(raw, locale),
        (prefs) => ({
            ...prefs,
            volume: clampVolume(prefs.volume),
        }),
    );
}
