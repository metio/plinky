// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Everything Plinky stores lives under the "plinky:" localStorage prefix — scores,
// mastery, prefs, favourites, history, streaks, ghosts, assignments. Wiping every
// such key (and nothing else) returns the device to a fresh-install state; the caller
// reloads so first-run seeding runs again. Handy for trying flows from scratch in dev,
// and for a player who wants to start over.

const PREFIX = "plinky:";

// Remove all Plinky state from this device and report how many keys were cleared.
// Other sites' keys are left untouched. Does not reload — the caller decides when.
export function resetDevice(): number {
    if (typeof localStorage === "undefined") {
        return 0;
    }
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PREFIX)) {
            keys.push(key);
        }
    }
    for (const key of keys) {
        localStorage.removeItem(key);
    }
    return keys.length;
}
