// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, type Prefs } from "../../core/prefs";
import { usePrefsStore } from "../contexts/services";

// Subscribe a component to the injected preferences store: it re-renders when any
// preference changes — a toggle flipped on the Settings route re-labels every
// keyboard at once — and it has no idea where the prefs live. The server and first
// hydration render the stable defaults; the real value lands on the client
// re-render, exactly like the rest of the persisted state.
export function usePrefs(): Prefs {
    const store = usePrefsStore();
    return useSyncExternalStore(store.subscribe, store.load, () => DEFAULT_PREFS);
}
