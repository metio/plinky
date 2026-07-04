// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NoteLabels } from "../../core/prefs";
import { usePrefs } from "./usePrefs";

// Subscribe an on-screen keyboard to the note-label preference, so toggling it on the
// Settings route re-labels every keyboard at once — the hero, the trainer, ear and
// compose — without a reload. A selector over the injected prefs store.
export function useNoteLabels(): NoteLabels {
    return usePrefs().noteLabels;
}
