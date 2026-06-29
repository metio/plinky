// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The fingering a player works out for a piece is hard-won, so it's saved per song and
// reused: returning to a passage shows the fingers you chose, and (later) the play page
// can show your fingering rather than the app's suggestion. Keyed by absolute position
// in the score — hand, bar, position within the bar, note within the chord — so it
// survives sliding the practice window around.

// "left|right:bar:pos:note" → finger (1–5).
export type FingerMap = Record<string, number>;

const storageKey = (songId: string) => `plinky:fingering:${songId}`;

export function fingerKey(hand: "left" | "right", bar: number, pos: number, note: number): string {
    return `${hand}:${bar}:${pos}:${note}`;
}

export function loadSongFingering(songId: string): FingerMap {
    try {
        const parsed = JSON.parse(localStorage.getItem(storageKey(songId)) ?? "{}");
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
    } catch {
        return {};
    }
}

function save(songId: string, map: FingerMap): void {
    try {
        localStorage.setItem(storageKey(songId), JSON.stringify(map));
    } catch {
        // Best-effort, like the rest of the local state.
    }
}

// Record one finger choice and persist the whole map. Returns the updated map so the
// caller can keep rendering from it without re-reading storage.
export function setFinger(
    songId: string,
    map: FingerMap,
    hand: "left" | "right",
    bar: number,
    pos: number,
    note: number,
    finger: number,
): FingerMap {
    const next = { ...map, [fingerKey(hand, bar, pos, note)]: finger };
    save(songId, next);
    return next;
}

// Clear every saved finger for a song — the "start this piece's fingering over" action.
export function clearSongFingering(songId: string): void {
    try {
        localStorage.removeItem(storageKey(songId));
    } catch {
        // Best-effort.
    }
}
