// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Prefs } from "./prefs";

// One setting the player changed, as a usage-tracking dimension. Nothing here is
// personal — the setting's name and its new value, never who set it.
export type PrefChange = { setting: string; value: string | number | boolean };

const isScalar = (value: unknown): value is string | number | boolean =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean";

// Drag-continuous controls whose every intermediate value would flood analytics with
// noise — the slider fires a write per pixel. We learn nothing from `volume: 51` after
// `volume: 50`; the discrete steppers (reveal tries, review cap, subdivision) are left
// in, since each of their changes is a deliberate pick.
const CONTINUOUS: ReadonlySet<string> = new Set(["volume"]);

// The settings that changed between two prefs snapshots, as tracking events. A scalar
// value is reported as-is; a structured one (the key map, the hand span) reports
// "changed", since its shape isn't a tracking dimension — only that the player adjusted
// it. A key in one snapshot but not the other is ignored: that is a schema change, not
// a player action.
export function prefChanges(prev: Prefs, next: Prefs): PrefChange[] {
    const changes: PrefChange[] = [];
    for (const key of Object.keys(next) as (keyof Prefs)[]) {
        if (!(key in prev) || CONTINUOUS.has(key)) {
            continue;
        }
        const before = prev[key];
        const after = next[key];
        if (isScalar(before) && isScalar(after)) {
            if (before !== after) {
                changes.push({ setting: key, value: after });
            }
        } else if (JSON.stringify(before) !== JSON.stringify(after)) {
            changes.push({ setting: key, value: "changed" });
        }
    }
    return changes;
}
