// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { foldPractice, type History, parseHistory } from "../../core/history";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, type JsonStore } from "./jsonStore";

// The practice tally: notes per day. record() folds a finished run onto today
// and notifies subscribers, so persistent UI (the header grade badge, the home
// Today panel) refreshes without a reload — the practice happens deep in a
// route, the badge in the layout.
export type HistoryStore = JsonStore<History> & {
    // Returns whether the tally is safely on the device — false when the write was
    // refused, so a caller can tell the player their practice was not recorded. A day
    // that folds to the tally already held needs no write and reports true.
    record(notes: number, now?: Date): boolean;
};

// The pre-paint bootstrap script in the app root reads this key directly (it runs
// before React), so the key is exported for it.
export const HISTORY_STORAGE_KEY = "plinky:history";

// The pre-paint bootstrap the app root inlines beside the theme's: marks a device
// that has played before, so Today can open on the day's practice while the
// prerendered document still carries the introduction for a first visit and for
// anything reading the page without running it.
//
// It has to run before paint for the same reason the theme's does — deciding after
// hydration would show the introduction and then take it away, and a page that
// rearranges itself on every visit is worse than either version of it.
export function returningBootstrapScript(): string {
    return (
        "(function(){try{" +
        `var h=localStorage.getItem(${JSON.stringify(HISTORY_STORAGE_KEY)});` +
        'if(h&&h!=="{}"){document.documentElement.setAttribute("data-returning","");}' +
        "}catch(e){}})();"
    );
}

export function createHistoryStore(kv: KeyValueStore): HistoryStore {
    const store = createJsonStore(kv, HISTORY_STORAGE_KEY, parseHistory);
    return {
        ...store,
        record(notes, now = new Date()) {
            const folded = foldPractice(store.load(), notes, now);
            if (folded === store.load()) {
                return true;
            }
            return store.save(folded);
        },
    };
}
