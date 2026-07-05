// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";
import { createKeyedJsonStore } from "./jsonStore";

// The fingering a player works out for a piece is hard-won, so it's saved per
// song and reused: returning to a passage shows the fingers you chose, and the
// play page shows your fingering rather than the app's suggestion. Keyed by
// absolute position in the score — hand, bar, position within the bar, note
// within the chord — so it survives sliding the practice window around.

// "left|right:bar:pos:note" → finger (1–5).
export type FingerMap = Record<string, number>;

export function fingerKey(hand: "left" | "right", bar: number, pos: number, note: number): string {
    return `${hand}:${bar}:${pos}:${note}`;
}

export type FingeringStore = {
    load(songId: string): FingerMap;
    // Record one finger choice and persist the whole map. Returns the updated
    // map so the caller can keep rendering from it without re-reading storage,
    // plus whether the write landed — an unpersisted map still renders this
    // session but is gone after a reload, and the storage banner says so.
    setFinger(
        songId: string,
        map: FingerMap,
        hand: "left" | "right",
        bar: number,
        pos: number,
        note: number,
        finger: number,
    ): { map: FingerMap; stored: boolean };
    // Clear every saved finger for a song — "start this piece's fingering over".
    clear(songId: string): void;
    subscribe(onChange: () => void): () => void;
};

export function createFingeringStore(kv: KeyValueStore): FingeringStore {
    const store = createKeyedJsonStore<FingerMap>(kv, "plinky:fingering:", (raw) => {
        // Keep only valid finger numbers, so a corrupt store can't feed nonsense
        // into the drill or the score's fingering display.
        const clean: FingerMap = {};
        if (raw && typeof raw === "object") {
            for (const [key, value] of Object.entries(raw)) {
                if (typeof value === "number" && value >= 1 && value <= 5) {
                    clean[key] = value;
                }
            }
        }
        return clean;
    });
    return {
        load: (songId) => store.load(songId) ?? {},
        setFinger(songId, map, hand, bar, pos, note, finger) {
            const next = { ...map, [fingerKey(hand, bar, pos, note)]: finger };
            return { map: next, stored: store.save(songId, next) };
        },
        clear: (songId) => store.remove(songId),
        subscribe: store.subscribe,
    };
}
