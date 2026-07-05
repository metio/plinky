// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The scores a user has starred, kept on the device. The home page shows these
// rather than the whole catalog, so a large library stays manageable.

import { browserStore } from "../adapters/browserStore";
import { readJson, writeJson } from "../stores/jsonStore";
const KEY = "plinky:favorites";

export function loadFavorites(): Set<string> {
    const parsed = readJson(browserStore, KEY);
    return new Set(
        Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [],
    );
}

function saveFavorites(ids: Set<string>): void {
    writeJson(browserStore, KEY, [...ids]);
}

export function isFavorite(id: string): boolean {
    return loadFavorites().has(id);
}

// Flip a score's starred state and persist, returning the updated set so a caller
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
