// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Composition, decodeComposition, encodeComposition } from "./composition";

// A saved performance of a piece — your own play, kept per song so you can hear it
// back, download it, and (the fastest one) race it as your ghost. A take IS a
// Composition, so it reuses Compose's compact share codec for storage and its MIDI /
// MusicXML exporters and synth playback for free.
export type Take = {
    id: string;
    // Wall-clock ms when saved, for ordering and a "2m ago" label.
    createdAt: number;
    // The grade letter earned on this run, so the list scans at a glance ("Take · B").
    letter: string;
    // True once the player reached the end of the piece (vs stopped partway) — only a
    // complete take is eligible to become the race ghost.
    complete: boolean;
    composition: Composition;
};

// At most this many takes per song; the oldest are dropped so storage can't grow
// without bound. The cap is generous enough to keep a few good attempts.
export const MAX_TAKES_PER_SONG = 5;

const storageKey = (songId: string) => `plinky:takes:${songId}`;

// Compact on-disk shape: the meta plus the composition as a share code, so a take
// costs little more than its note list zlib-compressed.
type StoredTake = {
    id: string;
    createdAt: number;
    letter: string;
    complete: boolean;
    code: string;
};

export function loadTakes(songId: string): Take[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(storageKey(songId)) ?? "[]");
        if (!Array.isArray(parsed)) {
            return [];
        }
        const takes: Take[] = [];
        for (const entry of parsed) {
            if (!entry || typeof entry.id !== "string" || typeof entry.code !== "string") {
                continue;
            }
            const composition = decodeComposition(entry.code);
            if (!composition) {
                continue;
            }
            takes.push({
                id: entry.id,
                createdAt: typeof entry.createdAt === "number" ? entry.createdAt : 0,
                letter: typeof entry.letter === "string" ? entry.letter : "",
                complete: entry.complete === true,
                composition,
            });
        }
        return takes;
    } catch {
        // No storage (SSR), blocked storage, or corrupt data — no takes to show.
        return [];
    }
}

function store(songId: string, takes: Take[]): boolean {
    try {
        const stored: StoredTake[] = takes.map((take) => ({
            id: take.id,
            createdAt: take.createdAt,
            letter: take.letter,
            complete: take.complete,
            code: encodeComposition(take.composition),
        }));
        localStorage.setItem(storageKey(songId), JSON.stringify(stored));
        return true;
    } catch {
        return false;
    }
}

// Add a take, newest first, keeping at most MAX_TAKES_PER_SONG (oldest dropped).
// Returns the resulting list so the caller can render it without re-reading.
export function saveTake(songId: string, take: Take): Take[] {
    const next = [take, ...loadTakes(songId).filter((other) => other.id !== take.id)].slice(
        0,
        MAX_TAKES_PER_SONG,
    );
    store(songId, next);
    return next;
}

export function removeTake(songId: string, takeId: string): Take[] {
    const next = loadTakes(songId).filter((take) => take.id !== takeId);
    store(songId, next);
    return next;
}

// The onset times of the fastest complete take — the ghost to race — or null when
// there's no complete take. "Fastest" is the shortest span from first note to last,
// so the quickest clean run sets the pace.
export function fastestTakeOnsets(takes: Take[]): number[] | null {
    const span = (take: Take): number => {
        const notes = take.composition.notes;
        if (notes.length === 0) {
            return Number.POSITIVE_INFINITY;
        }
        return notes[notes.length - 1]!.startMs - notes[0]!.startMs;
    };
    const complete = takes.filter((take) => take.complete && take.composition.notes.length > 0);
    if (complete.length === 0) {
        return null;
    }
    const fastest = complete.reduce((best, take) => (span(take) < span(best) ? take : best));
    const origin = fastest.composition.notes[0]!.startMs;
    return fastest.composition.notes.map((note) => note.startMs - origin);
}
