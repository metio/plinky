// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    addManualSession,
    foldSession,
    type ManualEntry,
    type Mood,
    type PracticeLog,
    type PracticePing,
    parsePracticeLog,
    removeSession,
    setSessionMood,
} from "../../core/practiceSession";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, type JsonStore } from "./jsonStore";

// The practice diary: how long was spent playing, and when. The note tally in
// historyStore answers "how much"; this answers "for how long", which is the
// question a report to a teacher is built around.
//
// record() folds a finished run into the sitting in progress rather than appending
// a row per run, so a half-hour at the piano reads as one session and not as
// eighteen. Every mutator returns the write verdict, so a caller with its own
// "saved" indicator can gate on it.
export type PracticeLogStore = JsonStore<PracticeLog> & {
    record(ping: PracticePing): boolean;
    addManual(entry: ManualEntry): boolean;
    remove(start: number): boolean;
    setMood(start: number, mood: Mood | null): boolean;
};

export function createPracticeLogStore(kv: KeyValueStore): PracticeLogStore {
    const store = createJsonStore(kv, "plinky:practice-log", parsePracticeLog);

    // A no-op fold returns the same array, so an unchanged log needs no write and
    // wakes no subscriber — and still reports success, because nothing was lost.
    const apply = (next: PracticeLog): boolean => next === store.load() || store.save(next);

    return {
        ...store,
        record(ping) {
            return apply(foldSession(store.load(), ping));
        },
        addManual(entry) {
            // An entry the log will not take — invalid, or dated before the oldest of the
            // capped 2000 and sliced straight back off — comes back as the very same
            // array, and that identity is the signal. `apply` reads an unchanged log as
            // success, which is right for a genuine no-op and wrong for a refusal, so the
            // refusal has to be caught before it gets there.
            const before = store.load();
            const next = addManualSession(before, entry);
            return next !== before && apply(next);
        },
        remove(start) {
            return apply(removeSession(store.load(), start));
        },
        setMood(start, mood) {
            return apply(setSessionMood(store.load(), start, mood));
        },
    };
}
