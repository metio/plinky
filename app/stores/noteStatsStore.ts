// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { foldRun, type NoteStats, normalizeNoteStats, type StatNote } from "../../core/noteStats";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, parseJson } from "./jsonStore";

// How long each note takes to find, accumulated over every run. One entry per MIDI
// note, so the whole record is bounded by the size of a keyboard however long
// somebody plays.

export type NoteStatsStore = {
    load(): NoteStats;
    // Fold a finished run in. Returns whether the write landed, like every store.
    record(notes: StatNote[]): boolean;
    subscribe(onChange: () => void): () => void;
};

export function createNoteStatsStore(kv: KeyValueStore): NoteStatsStore {
    const store = createJsonStore<NoteStats>(kv, "plinky:notestats", (raw) =>
        parseJson(raw, {}, normalizeNoteStats),
    );
    return {
        load: store.load,
        record: (notes) => store.save(foldRun(store.load(), notes)),
        subscribe: store.subscribe,
    };
}
