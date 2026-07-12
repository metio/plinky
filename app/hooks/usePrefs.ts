// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, type Prefs } from "../../core/prefs";
import { usePrefsStore } from "../contexts/services";

export type UsePrefsResult = {
    prefs: Prefs;
    // Merge a partial change onto the latest stored prefs and persist it. Merging
    // at save time (not over a component's stale snapshot) means two panels editing
    // different preferences on the same page can never clobber each other. Returns
    // the store's write verdict.
    update: (change: Partial<Prefs>) => boolean;
};

// Subscribe a component to the preferences and hand it the one safe way to write
// them back. Every consumer sees the same store snapshot, and a save anywhere —
// this component, another panel, another tab — re-renders them all. Server render
// and first hydration get the defaults; the persisted value lands on the client
// re-render like the rest of the stored state.
export function usePrefs(): UsePrefsResult {
    const store = usePrefsStore();
    const prefs = useSyncExternalStore(store.subscribe, store.load, () => DEFAULT_PREFS);
    const update = useCallback(
        (change: Partial<Prefs>) => store.save({ ...store.load(), ...change }),
        [store],
    );
    return useMemo(() => ({ prefs, update }), [prefs, update]);
}
