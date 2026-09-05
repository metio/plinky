// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { nextIn } from "../../../core/cycle";
import {
    NOTE_HINT_CYCLE,
    NOTE_LABEL_CYCLE,
    type NoteHints,
    type NoteLabels,
} from "../../../core/prefs";
import { m } from "../../paraglide/messages.js";
import { KeysIcon, SpeakerOffIcon, SpeakerIcon } from "../ui/icons";
import { ToggleIconButton } from "../ui/toggleIconButton";

// The keyboard's own quick controls, sitting right above the keys in full
// screen: fold the keys away, cycle the note names, cycle the next-note hint,
// and hand the sound back to a piano that makes its own.
// Each is a shortcut onto the same preference the tools drawer and Settings
// edit with full captions — one source of truth, two doors — so a change here
// is a change everywhere.

// Filled / half / empty: how much the keyboard gives away about the next note.
const hintGlyph: Record<NoteHints, string> = { always: "◉", miss: "◐", never: "○" };

const CYCLE_BUTTON =
    "min-w-9 rounded-md px-2 py-1 text-xs font-medium tabular-nums text-muted hover:bg-subtle hover:text-ink";

// The glyph stands for the naming itself: letters, the one landmark letter, the
// first solfège syllable, or nothing.
const labelGlyph: Record<NoteLabels, string> = {
    all: "ABC",
    c: "C",
    solfege: "do",
    off: "–",
};

export function KeyboardQuickControls({
    hidden,
    onToggleHidden,
    noteLabels,
    onNoteLabels,
    noteHints,
    onNoteHints,
    instrumentSounds,
    onInstrumentSounds,
    floating = false,
}: {
    // Whether the keys are folded away; the cluster stays visible as the way back.
    hidden: boolean;
    onToggleHidden: () => void;
    noteLabels: NoteLabels;
    onNoteLabels: (value: NoteLabels) => void;
    // When the keyboard lights the next note to play: always / after a miss / never.
    // Optional: a free-play surface (compose) has no "next note" to hint, so it
    // omits the pair and the cycle button stays off the bar.
    noteHints?: NoteHints;
    onNoteHints?: (value: NoteHints) => void;
    // Your instrument is sounding your notes already, so Plinky stays out of the way.
    // Optional, like the hint pair: a surface with no instrument in play omits it.
    instrumentSounds?: boolean;
    onInstrumentSounds?: (value: boolean) => void;
    // Pin the cluster to its nearest positioned ancestor's bottom-right corner —
    // the score box — instead of taking a row of its own. Out of the flow, hiding
    // the keys frees their whole strip for the score.
    floating?: boolean;
}) {
    return (
        <div
            className={`flex items-center justify-end gap-1 ${
                floating ? "absolute right-3 bottom-3 z-10 rounded-md bg-raised/90 shadow-sm" : ""
            }`}
        >
            {!hidden && (
                <>
                    <button
                        type="button"
                        onClick={() => onNoteLabels(nextIn(NOTE_LABEL_CYCLE, noteLabels))}
                        aria-label={`${m.settings_note_labels()}: ${
                            noteLabels === "all"
                                ? m.note_labels_all()
                                : noteLabels === "c"
                                  ? m.note_labels_c()
                                  : noteLabels === "solfege"
                                    ? m.note_labels_solfege()
                                    : m.note_labels_off()
                        }`}
                        className={CYCLE_BUTTON}
                    >
                        {labelGlyph[noteLabels]}
                    </button>
                    {noteHints !== undefined && onNoteHints !== undefined && (
                        <button
                            type="button"
                            onClick={() => onNoteHints(nextIn(NOTE_HINT_CYCLE, noteHints))}
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
                    )}
                </>
            )}
            {/* Outside the fold, unlike the two cycles: folding the keys away is what a
                player with a real piano in front of them does, which is exactly who this
                switch is for. */}
            {instrumentSounds !== undefined && onInstrumentSounds !== undefined && (
                <ToggleIconButton
                    pressed={instrumentSounds}
                    label={m.settings_instrument_sounds()}
                    onClick={() => onInstrumentSounds(!instrumentSounds)}
                >
                    {instrumentSounds ? <SpeakerOffIcon /> : <SpeakerIcon />}
                </ToggleIconButton>
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
