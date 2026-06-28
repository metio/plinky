// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { lastDailyDone } from "./dailyDone";
import { loadHistory } from "./history";
import { isDefaultKeyMap } from "./keyMap";
import { loadAllMastery } from "./mastery";
import { loadPrefs } from "./prefs";

// The feature-discovery checklist: a gentle, opt-in nudge to meet the app's corners,
// never a gate on progression. Some steps are read from real state (you've played,
// you've set your hand, you've done a daily); the rest are marked the first time you
// reach a feature, since "tried Ear once" leaves no other trace to read back.
export type DiscoveryId =
    | "played"
    | "handSet"
    | "dailyDone"
    | "earTried"
    | "fingeringTried"
    | "composed"
    | "imported"
    | "keysCustomized";

// The steps marked by doing them — features that record no lasting state of their own.
const MARKABLE: DiscoveryId[] = ["earTried", "fingeringTried", "composed", "imported"];

const KEY = "plinky:discovered";

function loadMarked(): Set<DiscoveryId> {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        return new Set(Array.isArray(parsed) ? (parsed as DiscoveryId[]) : []);
    } catch {
        return new Set();
    }
}

// Record that the player has reached a markable feature. A no-op for derived steps,
// whose completion is read from real state instead.
export function markDiscovered(id: DiscoveryId): void {
    if (!MARKABLE.includes(id)) {
        return;
    }
    try {
        const marked = loadMarked();
        if (!marked.has(id)) {
            marked.add(id);
            localStorage.setItem(KEY, JSON.stringify([...marked]));
        }
    } catch {
        // Best-effort — a checklist item un-ticking is harmless.
    }
}

// Which discovery steps are done: the derived ones from real state, the rest from the
// marked set.
export function discoveries(): Record<DiscoveryId, boolean> {
    const prefs = loadPrefs();
    const span = prefs.handSpan;
    const marked = loadMarked();
    return {
        played:
            loadAllMastery().length > 0 || Object.values(loadHistory()).some((notes) => notes > 0),
        handSet: span.left !== null || span.right !== null,
        dailyDone: lastDailyDone() > 0,
        earTried: marked.has("earTried"),
        fingeringTried: marked.has("fingeringTried"),
        composed: marked.has("composed"),
        imported: marked.has("imported"),
        keysCustomized: !isDefaultKeyMap(prefs.keyMap),
    };
}

export type DiscoveryProgress = { done: number; total: number; allDone: boolean };

export function discoveryProgress(done: Record<DiscoveryId, boolean>): DiscoveryProgress {
    const values = Object.values(done);
    const count = values.filter(Boolean).length;
    return { done: count, total: values.length, allDone: count === values.length };
}
