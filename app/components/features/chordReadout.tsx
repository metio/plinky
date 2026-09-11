// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type HeldSound, nameHeldNotes } from "../../../core/chordNaming";
import type { Naming } from "../../../core/noteNaming";
import { noteNameOf, type PitchClass } from "../../../core/theory";
import { localNaming, noteText, opening } from "../../lib/noteNames";
import { chordName, intervalName } from "../../lib/theoryNames";
import { m } from "../../paraglide/messages.js";

// What the hands are holding, said out loud.
//
// The theory pages name a chord you PICK from a list, which answers "what does a minor
// seventh sound like". This answers the question a player asks with their hands already
// down — "what is this thing I just found?" — which is the one nobody can look up,
// because you cannot search for a sound you cannot name.
//
// Every note is named as the keys under the hands name it: C and C♯ where the keys say
// letters, H and Cis where they say German letters, "ré dièse" where they say do re mi.
// An inversion is written as a slash chord — C major / E — rather than as a sentence
// about which note is underneath; the quality word and where it sits beside the root are
// the language's own.

function say(sound: HeldSound, naming: Naming): string {
    const note = (pitchClass: PitchClass) => noteText(noteNameOf(pitchClass), naming);
    switch (sound.kind) {
        case "note":
            return note(sound.pitchClass);
        case "interval":
            return `${note(sound.lower)} · ${intervalName(sound.interval)}`;
        case "chord": {
            const named = m.chord_named({
                root: note(sound.root),
                quality: chordName(sound.quality),
            });
            if (sound.inversion === 0) {
                return named;
            }
            // The bass note after a slash: how a chart writes an inversion, and how a
            // player says it out loud.
            return `${named} / ${note(sound.bass)}`;
        }
    }
}

export function ChordReadout({
    notes,
    naming = localNaming(),
}: {
    notes: readonly number[];
    // The player's naming, so the readout says what the keys print.
    naming?: Naming;
}) {
    const held = nameHeldNotes(notes);
    // One key gets no readout. The keys can already print their own names, so a single
    // letter under the keyboard says what the key under the finger says — and the reason
    // this is here at all is the sound you CANNOT look up: a shape your hand knows and
    // your vocabulary does not. That starts at two notes.
    const sound = held?.kind === "note" ? null : held;
    return (
        // Held open whether or not anything is sounding, so naming a chord does not push
        // the page down under the reader's hands mid-play.
        <p
            role="status"
            aria-live="polite"
            className="flex h-6 items-center justify-center text-sm font-medium text-accent-strong tabular-nums"
        >
            {sound === null ? "" : opening(say(sound, naming), naming)}
        </p>
    );
}
