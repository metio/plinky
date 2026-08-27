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
// and nothing on screen saying so. So the previous values are held first, and a refusal
// puts them back.
//
// The pruning runs last and only on success: dropping keys the bundle does not carry is
// what makes this a restore rather than a merge, so a piece deleted before backing up
// does not come back to life on the other device.
export function importProgress(kv: KeyValueStore, json: string): RestoreResult {
    const result = parseProgressPack(json);
    if (!result.ok) {
        return { ok: false, problem: result.problem };
    }

    const { entries, savedAt } = result.pack;
    // Each write, with what the device held there before it. Only what actually landed
    // needs undoing — a refusal on the first key has changed nothing, and there is no
    // sense reporting a failed rollback of nothing.
    const landed: [string, string | null][] = [];

    for (const [key, value] of Object.entries(entries)) {
        const full = PREFIX + key;
        const before = kv.get(full);
        if (kv.set(full, value)) {
            landed.push([full, before]);
            continue;
        }
        // Put back everything written so far. A key the device did not hold before is
        // removed rather than restored, so a failed restore leaves no half of the bundle
        // behind.
        let undone = true;
        for (const [written, previous] of landed) {
            if (previous === null) {
                kv.remove(written);
            } else if (!kv.set(written, previous)) {
                // The device refused even a value it was already holding. Nothing more
                // can be done from here, and saying "nothing changed" would be a lie.
                undone = false;
            }
        }
        return { ok: false, problem: "storage", undone };
    }
    const restored = landed.length;

    const keep = new Set(Object.keys(entries).map((key) => PREFIX + key));
    for (const key of kv.keys()) {
        if (key.startsWith(PREFIX) && !keep.has(key)) {
            kv.remove(key);
        }
    }
    return { ok: true, restored, savedAt };
}
