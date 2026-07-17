// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type IntervalId, intervalIdOf, SEMITONES_PER_OCTAVE } from "../../core/theory";
import { m } from "../paraglide/messages.js";

// core/theory names things with identifiers so it can stay pure and language-neutral.
// This is where an id becomes words — the one edge that knows both vocabularies. The
// tables are exhaustive by type, so adding an interval to core won't compile until it
// has a translated name.

export const INTERVAL_NAMES: Record<IntervalId, () => string> = {
    unison: m.theory_interval_unison,
    "minor-second": m.theory_interval_minor_second,
    "major-second": m.theory_interval_major_second,
    "minor-third": m.theory_interval_minor_third,
    "major-third": m.theory_interval_major_third,
    "perfect-fourth": m.theory_interval_perfect_fourth,
    tritone: m.theory_interval_tritone,
    "perfect-fifth": m.theory_interval_perfect_fifth,
    "minor-sixth": m.theory_interval_minor_sixth,
    "major-sixth": m.theory_interval_major_sixth,
    "minor-seventh": m.theory_interval_minor_seventh,
    "major-seventh": m.theory_interval_major_seventh,
    octave: m.theory_interval_octave,
};

export function intervalName(interval: IntervalId): string {
    return INTERVAL_NAMES[interval]();
}

// Names a literal distance in semitones — a measured hand reach, not an interval heard
// in a quiz — so unlike intervalIdOf it must NOT fold a compound down to its simple
// form: a hand that spans a tenth reaches a tenth, not a third. Within an octave it is
// the plain interval name; wider, it composes the already-translated octave word with
// the simple remainder ("Octave + Major third"), so no locale needs a new string and
// the "+" sidesteps every language's grammar for joining the two. Beyond two octaves
// the number carries it — a reach that large is only a stray MIDI value — so the gloss
// is dropped and the caller's semitone count stands alone.
export function spanName(semitones: number): string | null {
    const size = Math.abs(Math.round(semitones));
    if (size <= SEMITONES_PER_OCTAVE) {
        return intervalName(intervalIdOf(size));
    }
    if (size < SEMITONES_PER_OCTAVE * 2) {
        return `${INTERVAL_NAMES.octave()} + ${intervalName(intervalIdOf(size))}`;
    }
    return null;
}
