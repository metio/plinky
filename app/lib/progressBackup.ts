// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    parseProgressPack,
    type ProgressPackProblem,
    serializeProgress,
} from "../../core/progressPack";
import type { KeyValueStore } from "../ports/keyValueStore";
import { PREFIX } from "./resetDevice";

// Reading and restoring a whole device's Plinky state through the storage seam.
// The bundle format itself is `core/progressPack`; this is the half that knows
// where the values live.
//
// Everything under the prefix travels, the score library included — a backup that
// silently omitted a piece of your progress would be worse than none, because you
// would only find out at the moment you needed it.

// Every stored key with the prefix stripped, ready for a bundle.
//
// Built through fromEntries because it defines own data properties: a plain
// `entries[key] = value` reaches the prototype for a key of "__proto__" and, since
// the value is a string, silently keeps nothing — so that one entry would vanish
// from the backup while the device still held it. The bundle format guards the same
// hazard on the way in (see pickStringEntries); this is the reading half.
function readEntries(kv: KeyValueStore): Record<string, string> {
    const pairs: Array<[string, string]> = [];
    for (const key of kv.keys()) {
        if (!key.startsWith(PREFIX)) {
            continue;
        }
        const value = kv.get(key);
        if (value !== null) {
            pairs.push([key.slice(PREFIX.length), value]);
        }
    }
    return Object.fromEntries(pairs);
}

// How many values this device holds — what the backup would carry, so the UI can
// say so before the player commits to anything.
export function countProgressEntries(kv: KeyValueStore): number {
    return Object.keys(readEntries(kv)).length;
}

// This device's whole Plinky state as a bundle. `savedAt` is supplied by the
// caller (the clock is an adapter concern, not this module's).
export function exportProgress(kv: KeyValueStore, savedAt: string): string {
    return serializeProgress(readEntries(kv), savedAt);
}

export type RestoreResult =
    | { ok: true; restored: number; savedAt: string }
    // The bundle could not be read. Nothing was touched.
    | { ok: false; problem: ProgressPackProblem }
    // The device refused a write — quota, or blocked storage. `undone` says whether the
    // writes that had already landed were put back, because the two leave the player in
    // very different places and only one of them can honestly be called "nothing
    // changed".
    | { ok: false; problem: "storage"; undone: boolean };

// Replace this device's state with a bundle's.
//
// A restore is all or nothing. Writing straight through and stopping at the first
// refusal leaves the device holding half of one device's progress and half of
// another's — mastery from the bundle, takes and ghosts from here — with no way back
// and nothing on screen saying so. So every change is recorded with the value it
// replaced, and a refusal puts them all back.
//
// Dropping keys the bundle does not carry is what makes this a restore rather than a
// merge, so a piece deleted before backing up does not come back to life on the other
// device. It runs first: the device's per-piece keys (takes, ghosts, mastery) and the
// bundle's are different keys, and writing the bundle beside them would need room for
// both at once, when the device afterwards holds only the bundle's.
export function importProgress(kv: KeyValueStore, json: string): RestoreResult {
    const result = parseProgressPack(json);
    if (!result.ok) {
        return { ok: false, problem: result.problem };
    }

    const { entries, savedAt } = result.pack;
    const keep = new Set(Object.keys(entries).map((key) => PREFIX + key));
    const changes: Change[] = [];

    const stale = kv.keys().filter((key) => key.startsWith(PREFIX) && !keep.has(key));
    // Clearing the device's values first is safe only where one can be put back. Under a
    // quota it always can, since the room it held is still free; a device that refuses
    // every write would lose them for good. So it is first asked to take back a value it
    // already holds, which needs no room at all, and one that refuses is left untouched.
    const probe = stale[0];
    const held = probe === undefined ? null : kv.get(probe);
    if (probe !== undefined && held !== null && !kv.set(probe, held)) {
        return { ok: false, problem: "storage", undone: true };
    }
    for (const key of stale) {
        const before = kv.get(key);
        kv.remove(key);
        if (before !== null) {
            changes.push({ key, before, after: null });
        }
    }

    let restored = 0;
    for (const [key, value] of Object.entries(entries)) {
        const full = PREFIX + key;
        const before = kv.get(full);
        if (!kv.set(full, value)) {
            return { ok: false, problem: "storage", undone: rollBack(kv, changes) };
        }
        changes.push({ key: full, before, after: value });
        restored += 1;
    }
    return { ok: true, restored, savedAt };
}

// One change a restore made: the value a key held before (null when it was absent) and
// the value it holds now (null when it was removed).
type Change = { key: string; before: string | null; after: string | null };

// Undoes every change, and says whether all of them landed.
//
// The undos that free room run before the ones that need it. Taking away a key the
// bundle brought frees room; putting back a value larger than the one there now needs
// room. Applied smallest growth first, the device only shrinks from where the refusal
// left it and then grows back to exactly what it held before the restore began — both
// of which fit — so a quota that admitted the device once admits every step back.
function rollBack(kv: KeyValueStore, changes: Change[]): boolean {
    const growth = ({ before, after }: Change) => (before?.length ?? 0) - (after?.length ?? 0);
    let undone = true;
    for (const { key, before } of [...changes].sort((a, b) => growth(a) - growth(b))) {
        if (before === null) {
            kv.remove(key);
        } else if (!kv.set(key, before)) {
            // The device refused a value it held a moment ago. Nothing more can be done
            // from here, and saying "nothing changed" would be a lie.
            undone = false;
        }
    }
    return undone;
}
