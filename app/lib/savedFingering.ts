// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The fingering a player works out for a piece is hard-won, so it's saved per song and
// reused: returning to a passage shows the fingers you chose, and (later) the play page
// can show your fingering rather than the app's suggestion. Keyed by absolute position
// in the score — hand, bar, position within the bar, note within the chord — so it
// survives sliding the practice window around.

// "left|right:bar:pos:note" → finger (1–5).

import { browserStore } from "../adapters/browserStore";
import { readJson, writeJson } from "../stores/jsonStore";
export type FingerMap = Record<string, number>;

const storageKey = (songId: string) => `plinky:fingering:${songId}`;

export function fingerKey(hand: "left" | "right", bar: number, pos: number, note: number): string {
    return `${hand}:${bar}:${pos}:${note}`;
}

export function loadSongFingering(songId: string): FingerMap {
    const parsed = readJson(browserStore, storageKey(songId));
    if (!parsed || typeof parsed !== "object") {
        return {};
    }
    // Keep only valid finger numbers, so a corrupt store can't feed nonsense into
    // the drill or the score's fingering display.
    const clean: FingerMap = {};
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "number" && value >= 1 && value <= 5) {
            clean[key] = value;
        }
    }
    return clean;
}

function save(songId: string, map: FingerMap): boolean {
    return writeJson(browserStore, storageKey(songId), map);
}

// Record one finger choice and persist the whole map. Returns the updated map so
// the caller can keep rendering from it without re-reading storage, plus whether
// the write landed — an unpersisted map still renders this session but is gone
// after a reload, and the storage banner tells the player so.
export function setFinger(
    songId: string,
    map: FingerMap,
    hand: "left" | "right",
    bar: number,
    pos: number,
    note: number,
    finger: number,
): { map: FingerMap; stored: boolean } {
    const next = { ...map, [fingerKey(hand, bar, pos, note)]: finger };
    return { map: next, stored: save(songId, next) };
}

// Clear every saved finger for a song — the "start this piece's fingering over" action.
export function clearSongFingering(songId: string): void {
    try {
        browserStore.remove(storageKey(songId));
    } catch {
        // Best-effort.
    }
}
