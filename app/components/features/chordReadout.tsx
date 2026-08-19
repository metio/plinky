// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type HeldSound, nameHeldNotes } from "../../../core/chordNaming";
import { NOTE_TEXT, noteNameOf, type PitchClass } from "../../../core/theory";
import { chordName, intervalName } from "../../lib/theoryNames";

// What the hands are holding, said out loud.
//
// The theory pages name a chord you PICK from a list, which answers "what does a minor
// seventh sound like". This answers the question a player asks with their hands already
// down — "what is this thing I just found?" — which is the one nobody can look up,
// because you cannot search for a sound you cannot name.
//
// Nearly all of it is notation, so nearly none of it is translated: a note is C in every
// language Plinky speaks, and an inversion is written as a slash chord — C major / E —
// rather than as a sentence about which note is underneath. Only the quality word is a
// word, and the theory course already has those in 26 languages.

const noteText = (pitchClass: PitchClass) => NOTE_TEXT[noteNameOf(pitchClass)];

function say(sound: HeldSound): string {
    switch (sound.kind) {
        case "note":
            return noteText(sound.pitchClass);
        case "interval":
            return `${noteText(sound.lower)} · ${intervalName(sound.interval)}`;
        case "chord": {
            const named = `${noteText(sound.root)} ${chordName(sound.quality)}`;
            if (sound.inversion === 0) {
                return named;
            }
            // The bass note after a slash: how a chart writes an inversion, and how a
            // player says it out loud.
            return `${named} / ${noteText(sound.bass)}`;
        }
    }
}

export function ChordReadout({ notes }: { notes: readonly number[] }) {
    const sound = nameHeldNotes(notes);
    return (
        // Held open whether or not anything is sounding, so naming a chord does not push
        // the page down under the reader's hands mid-play.
        <p
            role="status"
            aria-live="polite"
            className="flex h-6 items-center justify-center text-sm font-medium text-accent-strong tabular-nums"
        >
            {sound === null ? "" : say(sound)}
        </p>
    );
}
