// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { KeyValueStore } from "../ports/keyValueStore";
import { PREFIX } from "./resetDevice";

// Stored keys carried a different prefix before the rebrand, and a browser that practised
// under the old name still holds them: localStorage is keyed by origin, and the old origin
// still serves the app. Nothing reads those keys any more, so a device arriving here would
// show an empty library, an empty history and nothing to back up — while every byte of it
// sat in storage under a name this build never asks for.
//
// So the first thing built on a device's store carries them over. One pass over the keys,
// idempotent, and a no-op on every device that never saw the old name.
const LEGACY_PREFIX = "plinky:";

// Move each legacy key to the prefix this build reads, and report how many moved.
//
// A value already written under the current prefix wins: it belongs to this build, so the
// legacy one beside it is the older of the two and goes. A write the device refuses leaves
// the legacy key exactly where it is — a quota error must not turn into the deletion of
// the only copy, and the next visit can try again.
export function adoptLegacyKeys(kv: KeyValueStore): number {
    let moved = 0;
    for (const key of kv.keys()) {
        if (!key.startsWith(LEGACY_PREFIX)) {
            continue;
        }
        const value = kv.get(key);
        const current = `${PREFIX}${key.slice(LEGACY_PREFIX.length)}`;
        if (kv.get(current) === null) {
            if (value === null || !kv.set(current, value)) {
                continue;
            }
            moved += 1;
        }
        kv.remove(key);
    }
    return moved;
}
