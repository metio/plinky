// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useState } from "react";
import type { Prefs } from "../../core/prefs";
import type { PrefsStore } from "../stores/prefsStore";

// Bind one device preference to auto-persisting React state: the value seeds from the
// prefs store on mount, and the setter writes the whole prefs record back before updating
// state, so the choice survives a reload. The other keys are carried through unchanged
// (read-modify-write), so two bound preferences never clobber each other's slice.
export function usePref<K extends keyof Prefs>(
    store: PrefsStore,
    key: K,
): [Prefs[K], (value: Prefs[K]) => void] {
    const [value, setValue] = useState(() => store.load()[key]);
    const set = useCallback(
        (next: Prefs[K]) => {
            store.save({ ...store.load(), [key]: next });
            setValue(next);
        },
        [store, key],
    );
    return [value, set];
}
