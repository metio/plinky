// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { useFavoritesStore } from "../contexts/services";

// The server render has no favorites; a stable reference keeps the snapshot quiet.
const EMPTY: ReadonlySet<string> = new Set();

// Subscribe a component to the starred set, re-rendering whenever a score is
// starred or unstarred anywhere in the app — this list, another tab, first-run
// seeding. Empty on the server.
export function useFavorites(): ReadonlySet<string> {
    const store = useFavoritesStore();
    return useSyncExternalStore(store.subscribe, store.load, () => EMPTY);
}
