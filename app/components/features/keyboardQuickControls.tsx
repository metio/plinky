// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NoteHints, NoteLabels } from "../../../core/prefs";
import { m } from "../../paraglide/messages.js";
import { KeysIcon } from "../ui/icons";
import { ToggleIconButton } from "../ui/toggleIconButton";

// The keyboard's own quick controls, sitting right above the keys in full
// screen: fold the keys away, cycle the note names, cycle the next-note hint.
// Each is a shortcut onto the same preference the tools drawer and Settings
// edit with full captions — one source of truth, two doors — so a change here
// is a change everywhere.

// Tap-to-cycle orders, each walking from most help to none.
const LABELS_CYCLE: NoteLabels[] = ["all", "c", "off"];
const HINTS_CYCLE: NoteHints[] = ["always", "miss", "never"];
// Filled / half / empty: how much the keyboard gives away about the next note.
const hintGlyph: Record<NoteHints, string> = { always: "◉", miss: "◐", never: "○" };

function nextIn<T>(cycle: readonly T[], current: T): T {
    const index = cycle.indexOf(current);
    return cycle[(index + 1) % cycle.length] as T;
}

const CYCLE_BUTTON =
    "min-w-9 rounded-md px-2 py-1 text-xs font-medium tabular-nums text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100";

const labelGlyph: Record<NoteLabels, string> = { all: "ABC", c: "C", off: "–" };

export function KeyboardQuickControls({
    hidden,
    onToggleHidden,
    noteLabels,
    onNoteLabels,
    noteHints,
    onNoteHints,
}: {
    // Whether the keys are folded away; the cluster stays visible as the way back.
    hidden: boolean;
    onToggleHidden: () => void;
    noteLabels: NoteLabels;
    onNoteLabels: (value: NoteLabels) => void;
    // When the keyboard lights the next note to play: always / after a miss / never.
    noteHints: NoteHints;
    onNoteHints: (value: NoteHints) => void;
}) {
    return (
        <div className="flex items-center justify-end gap-1">
            {!hidden && (
                <>
                    <button
                        type="button"
                        onClick={() => onNoteLabels(nextIn(LABELS_CYCLE, noteLabels))}
                        aria-label={`${m.settings_note_labels()}: ${
                            noteLabels === "all"
                                ? m.note_labels_all()
                                : noteLabels === "c"
                                  ? m.note_labels_c()
                                  : m.note_labels_off()
                        }`}
                        className={CYCLE_BUTTON}
                    >
                        {labelGlyph[noteLabels]}
                    </button>
                    <button
                        type="button"
                        onClick={() => onNoteHints(nextIn(HINTS_CYCLE, noteHints))}
                        aria-label={`${m.settings_note_hints()}: ${
                            noteHints === "always"
                                ? m.note_hints_always()
                                : noteHints === "miss"
                                  ? m.note_hints_miss()
                                  : m.note_hints_never()
                        }`}
                        className={CYCLE_BUTTON}
                    >
                        {hintGlyph[noteHints]}
                    </button>
                </>
            )}
            <ToggleIconButton
                pressed={hidden}
                label={hidden ? m.action_show_keyboard() : m.action_hide_keyboard()}
                onClick={onToggleHidden}
            >
                <KeysIcon />
            </ToggleIconButton>
        </div>
    );
}
