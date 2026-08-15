// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Prefs } from "../../core/prefs";
import type { PrefsStore } from "./prefsStore";

// A preferences store that cannot be written to, for a surface whose settings are part of
// what it measures — the placement drill, where the player's own reading aids would decide
// the result. Injected as the `prefs` capability over the subtree, so every component that
// reads a preference sees the fixed set without knowing it is in a test.
//
// `save` reports false, the same verdict the real store gives when a write does not land,
// so a caller that surfaces "saved" tells the truth. Nothing subscribes usefully: the
// value never changes, so the unsubscribe is a no-op rather than a leak.
export function createFixedPrefsStore(prefs: Prefs): PrefsStore {
    const frozen = Object.freeze({ ...prefs });
    return {
        load: () => frozen,
        save: () => false,
        subscribe: () => () => {},
    };
}
