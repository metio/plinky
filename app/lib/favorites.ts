// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The songs a user has starred, kept on the device. The home page shows these
// rather than the whole catalog, so a large library stays manageable.
const KEY = "plinky:favorites";

export function loadFavorites(): Set<string> {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        return new Set(
            Array.isArray(parsed)
                ? parsed.filter((id): id is string => typeof id === "string")
                : [],
        );
    } catch {
        return new Set();
    }
}

function saveFavorites(ids: Set<string>): void {
    try {
        localStorage.setItem(KEY, JSON.stringify([...ids]));
    } catch {
        // Persistence is best-effort; a private-mode failure is harmless.
    }
}

export function isFavorite(id: string): boolean {
    return loadFavorites().has(id);
}

// Flip a song's starred state and persist, returning the updated set so a caller
// can drive React state from it without a second read.
export function toggleFavorite(id: string): Set<string> {
    const ids = loadFavorites();
    if (ids.has(id)) {
        ids.delete(id);
    } else {
        ids.add(id);
    }
    saveFavorites(ids);
    return ids;
}
