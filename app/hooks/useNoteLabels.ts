// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, type NoteLabels } from "../../core/prefs";
import { usePrefsStore } from "../contexts/services";

// Subscribe an on-screen keyboard to the note-label preference, so toggling it on the
// Settings route re-labels every keyboard at once — the hero, the trainer, ear and
// compose — without a reload. The snapshot is the primitive label mode, not the whole
// prefs object, so a keyboard mounted mid-play does not re-render when an unrelated
// preference (volume, a score toggle) is saved. Server render and first hydration get
// the default; the real value lands on the client re-render like the rest of the
// persisted state.
export function useNoteLabels(): NoteLabels {
    const store = usePrefsStore();
    return useSyncExternalStore(
        store.subscribe,
        () => store.load().noteLabels,
        () => DEFAULT_PREFS.noteLabels,
    );
}
