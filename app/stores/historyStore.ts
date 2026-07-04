// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { foldPractice, type History, parseHistory } from "../../core/history";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, type JsonStore } from "./jsonStore";

// The practice tally: notes per day. record() folds a finished run onto today
// and notifies subscribers, so persistent UI (the header grade badge, the home
// Today panel) refreshes without a reload — the practice happens deep in a
// route, the badge in the layout.
export type HistoryStore = JsonStore<History> & {
    record(notes: number, now?: Date): void;
};

export function createHistoryStore(kv: KeyValueStore): HistoryStore {
    const store = createJsonStore(kv, "plinky:history", parseHistory);
    return {
        ...store,
        record(notes, now = new Date()) {
            const folded = foldPractice(store.load(), notes, now);
            if (folded !== store.load()) {
                store.save(folded);
            }
        },
    };
}
