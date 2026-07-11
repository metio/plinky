// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { KEYBOARD_OCTAVES, type NoteLabels } from "../../../core/prefs";
import { m } from "../../paraglide/messages.js";
import { KeysIcon } from "../ui/icons";
import { ToggleIconButton } from "../ui/toggleIconButton";

// The keyboard's own quick controls, sitting right above the keys in full
// screen: fold the keys away, cycle the window width, cycle the note names.
// Each is a shortcut onto the same preference the tools drawer and Settings
// edit with full captions — one source of truth, two doors — so a change here
// is a change everywhere.

// Tap-to-cycle orders. Octaves walk the useful widths then the whole piece;
// labels walk from most help to none.
const LABELS_CYCLE: NoteLabels[] = ["all", "c", "off"];

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
    octaves,
    onOctaves,
    noteLabels,
    onNoteLabels,
}: {
    // Whether the keys are folded away; the cluster stays visible as the way back.
    hidden: boolean;
    onToggleHidden: () => void;
    // The keyboard window width in octaves (0 = the whole piece, fixed).
    octaves: number;
    onOctaves: (value: number) => void;
    noteLabels: NoteLabels;
    onNoteLabels: (value: NoteLabels) => void;
}) {
    // The octave cycle starts from the allowed list with 0 (All) last, so
    // tapping reads as "wider, wider, wider, everything".
    const octaveCycle = [...KEYBOARD_OCTAVES.filter((n) => n !== 0), 0];
    return (
        <div className="flex items-center justify-end gap-1">
            {!hidden && (
                <>
                    <button
                        type="button"
                        onClick={() => onOctaves(nextIn(octaveCycle, octaves))}
                        aria-label={`${m.keyboard_octaves()}: ${
                            octaves === 0 ? m.keyboard_octaves_all() : octaves
                        }`}
                        className={CYCLE_BUTTON}
                    >
                        {octaves === 0 ? m.keyboard_octaves_all() : `${octaves}×`}
                    </button>
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
