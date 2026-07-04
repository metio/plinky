// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Everything Plinky stores lives under the "plinky:" localStorage prefix — scores,
// mastery, prefs, favourites, history, ghosts, assignments. Wiping every
// such key (and nothing else) returns the device to a fresh-install state; the caller
// reloads so first-run seeding runs again. Handy for trying flows from scratch in dev,
// and for a player who wants to start over.

import { browserStore } from "../adapters/browserStore";

const PREFIX = "plinky:";

// Remove all Plinky state from this device and report how many keys were cleared.
// Other sites' keys are left untouched. Does not reload — the caller decides when.
export function resetDevice(): number {
    const keys = browserStore.keys().filter((key) => key.startsWith(PREFIX));
    for (const key of keys) {
        browserStore.remove(key);
    }
    // Count what is actually gone rather than what was attempted, so a store that
    // refuses removals cannot make the reset claim a success it did not deliver.
    const remaining = browserStore.keys().filter((key) => key.startsWith(PREFIX)).length;
    return keys.length - remaining;
}
