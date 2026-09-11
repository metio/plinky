// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useSyncExternalStore } from "react";
import { type Naming, namingFor } from "../../core/noteNaming";
import { defaultPrefsFor } from "../../core/prefs";
import { usePrefsStore } from "../contexts/services";
import { getLocale } from "../paraglide/runtime.js";

// How this player's notes are named, for anything that names one: the naming the keys
// print, so a chord readout, an answer key or a scale's title never contradicts them.
// Subscribes to the two primitive choices it is made from rather than the whole prefs
// object, so an unrelated save does not re-render every note name on the page.
export function useNoteNaming(): Naming {
    const store = usePrefsStore();
    const locale = getLocale();
    const labels = useSyncExternalStore(
        store.subscribe,
        () => store.load().noteLabels,
        () => defaultPrefsFor(locale).noteLabels,
    );
    const letters = useSyncExternalStore(
        store.subscribe,
        () => store.load().noteLetters,
        () => defaultPrefsFor(locale).noteLetters,
    );
    return useMemo(() => namingFor(labels, locale, letters), [labels, locale, letters]);
}
