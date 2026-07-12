// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { History } from "./history";
import { isDefaultKeyMap } from "./keyMap";
import type { Prefs } from "./prefs";

// The feature-discovery checklist: a gentle, opt-in nudge to meet the app's corners,
// never a gate on progression. Some steps are read from real state (you've played,
// you've set your hand, you've done a daily); the rest are marked the first time you
// reach a feature, since "tried Ear once" leaves no other trace to read back.
export type DiscoveryId =
    | "midiConnected"
    | "played"
    | "handSet"
    | "dailyDone"
    | "earTried"
    | "fingeringTried"
    | "composed"
    | "imported"
    | "keysCustomized";

// The steps marked by doing them — features that record no lasting state of their own.
// keysCustomized is here too so it can be reached by engaging with the key editor:
// changing a key already shows in the saved map, but a player happy with the standard
// layout leaves no such trace, so opening the editor and touching it counts as well.
export const MARKABLE: readonly DiscoveryId[] = [
    "midiConnected",
    "earTried",
    "fingeringTried",
    "composed",
    "imported",
    "keysCustomized",
];

// What the discovery steps are computed from. The caller loads these from its
// stores and hands the data in — this module only derives.
export type DiscoveryState = {
    prefs: Prefs;
    // Whether any piece carries mastery state (any entry at all counts as playing).
    masteredCount: number;
    history: History;
    // The number of the last daily completed, 0 for none.
    lastDaily: number;
    // The markable steps already reached.
    marked: ReadonlySet<DiscoveryId>;
};

// Which discovery steps are done: the derived ones from the given state, the rest
// from the marked set.
export function discoveries(state: DiscoveryState): Record<DiscoveryId, boolean> {
    const { prefs, masteredCount, history, lastDaily, marked } = state;
    const span = prefs.handSpan;
    return {
        // Connecting is a one-time setup step; once a device has ever been seen,
        // the mark persists even when the piano is unplugged today.
        midiConnected: marked.has("midiConnected"),
        played: masteredCount > 0 || Object.values(history).some((notes) => notes > 0),
        handSet: span.left !== null || span.right !== null,
        dailyDone: lastDaily > 0,
        earTried: marked.has("earTried"),
        fingeringTried: marked.has("fingeringTried"),
        composed: marked.has("composed"),
        imported: marked.has("imported"),
        // Done once you've made the keys your own, or engaged with the editor and kept
        // the standard layout — so a player who likes the defaults isn't stuck on a step
        // that a non-default binding is otherwise the only way to reach.
        keysCustomized: marked.has("keysCustomized") || !isDefaultKeyMap(prefs.keyMap),
    };
}

export type DiscoveryProgress = { done: number; total: number; allDone: boolean };

export function discoveryProgress(done: Record<DiscoveryId, boolean>): DiscoveryProgress {
    const values = Object.values(done);
    const count = values.filter(Boolean).length;
    return { done: count, total: values.length, allDone: count === values.length };
}
