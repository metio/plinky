// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
function readEntries(kv: KeyValueStore): Record<string, string> {
    const entries: Record<string, string> = {};
    for (const key of kv.keys()) {
        if (!key.startsWith(PREFIX)) {
            continue;
        }
        const value = kv.get(key);
        if (value !== null) {
            entries[key.slice(PREFIX.length)] = value;
        }
    }
    return entries;
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
    // "storage" means the device refused the writes — quota, or blocked storage.
    | { ok: false; problem: ProgressPackProblem | "storage" };

// Replace this device's state with a bundle's.
//
// The writes land *before* anything is pruned, so a restore that runs out of quota
// leaves the device holding what it already had plus whatever fitted, rather than
// an emptied store. Only once every value is in do keys absent from the bundle go —
// that pruning is what makes this a restore rather than a merge, so a piece you
// deleted before backing up does not come back to life on the other device.
export function importProgress(kv: KeyValueStore, json: string): RestoreResult {
    const result = parseProgressPack(json);
    if (!result.ok) {
        return { ok: false, problem: result.problem };
    }

    const { entries, savedAt } = result.pack;
    let restored = 0;
    for (const [key, value] of Object.entries(entries)) {
        if (kv.set(PREFIX + key, value)) {
            restored++;
        }
    }
    if (restored < Object.keys(entries).length) {
        return { ok: false, problem: "storage" };
    }

    const keep = new Set(Object.keys(entries).map((key) => PREFIX + key));
    for (const key of kv.keys()) {
        if (key.startsWith(PREFIX) && !keep.has(key)) {
            kv.remove(key);
        }
    }
    return { ok: true, restored, savedAt };
}
