// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { loadPrefs, type NoteLabels, PREFS_CHANGED_EVENT } from "../lib/prefs";

// Subscribe an on-screen keyboard to the note-label preference, so toggling it on the
// Settings route re-labels every keyboard at once — the hero, the trainer, ear and
// compose — without a reload. savePrefs broadcasts PREFS_CHANGED_EVENT on the same
// tab; cross-tab changes arrive as `storage`. The snapshot is a primitive, so it is
// inherently stable and never loops useSyncExternalStore.
function subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") {
        return () => {};
    }
    window.addEventListener(PREFS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener(PREFS_CHANGED_EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
}

export function useNoteLabels(): NoteLabels {
    return useSyncExternalStore(
        subscribe,
        () => loadPrefs().noteLabels,
        // The server and first hydration render the default; the real value lands on
        // the client re-render, exactly as the keyboard's other localStorage state does.
        () => "c",
    );
}
