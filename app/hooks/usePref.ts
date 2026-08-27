// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback } from "react";
import type { Prefs } from "../../core/prefs";
import { usePrefs } from "./usePrefs";

// Bind one device preference to the store: the value follows whatever the store holds,
// and the setter writes the whole record back, carrying the other keys through unchanged
// so two bound preferences never clobber each other's slice.
//
// Built on usePrefs rather than on its own useState. Seeding from the store at mount and
// keeping a copy looks equivalent and is not: the same preference is edited from more
// than one place — the quick controls above the keys, the tools drawer, Settings — and a
// component holding a mount-time copy cannot see an edit made anywhere else. It went
// unnoticed because the play surface re-rendered continuously for unrelated reasons and
// picked the new value up within a frame, which is a coincidence rather than a design.
//
// Takes no store: the services context is the single source of truth for which one is in
// play, and a hook that could be handed a different one is the drift this prevents.
export function usePref<K extends keyof Prefs>(key: K): [Prefs[K], (value: Prefs[K]) => void] {
    const { prefs, update } = usePrefs();
    const set = useCallback(
        (next: Prefs[K]) => update({ [key]: next } as Partial<Prefs>),
        [update, key],
    );
    return [prefs[key], set];
}
