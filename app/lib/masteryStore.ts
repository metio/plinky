// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { PRACTICE_EVENT } from "./history";
import { loadMastery, type Mastery, saveMastery } from "./mastery";

// An external store over the per-score mastery in localStorage, so every view of a
// piece's mastery — the score's own badge, a MarkLearnedButton placed in a page
// header, the grade badge — reads one source of truth and re-renders together when
// a finished run or a manual mark changes it. saveMastery already broadcasts
// PRACTICE_EVENT; the store listens for that (and cross-tab `storage` events) and
// re-reads, which is what lets a header button and the viewer stay in step without
// passing state between them.

export function subscribeMastery(onChange: () => void): () => void {
    if (typeof window === "undefined") {
        return () => {};
    }
    window.addEventListener(PRACTICE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener(PRACTICE_EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
}

function sameMastery(a: Mastery | null, b: Mastery | null): boolean {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return (
        a.bestScore === b.bestScore &&
        a.learned === b.learned &&
        a.backlog === b.backlog &&
        a.intervalDays === b.intervalDays &&
        a.reviewAt === b.reviewAt &&
        a.updatedAt === b.updatedAt
    );
}

// useSyncExternalStore requires getSnapshot to return a stable reference while the
// value is unchanged, or it re-renders in a loop. We always re-read localStorage
// (cheap) so the snapshot can never go stale — it self-corrects after an external
// clear — and hand back the previously cached object whenever the value matches, so
// the reference only changes when the mastery actually does.
const cache = new Map<string, Mastery | null>();

export function masterySnapshot(id: string): Mastery | null {
    const fresh = loadMastery(id);
    const cached = cache.get(id);
    if (cache.has(id) && sameMastery(cached ?? null, fresh)) {
        return cached ?? null;
    }
    cache.set(id, fresh);
    return fresh;
}

// Persist and broadcast: saveMastery dispatches the event the store listens for, so
// every subscriber re-reads the fresh value.
export function writeMastery(id: string, mastery: Mastery): void {
    saveMastery(id, mastery);
}
