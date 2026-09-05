// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the score draws its slurs — the long arches that ask for notes to be joined.
//
// A slur is a span rather than a property of a note, and it has to be modelled as one
// because of how the engraving reports it: the arch is hung on the two notes at its ends
// and on nothing in between, so a note in the middle of a four-note slur carries no mark
// at all. Asking each note whether it is slurred therefore joins only the first pair and
// leaves the rest of the phrase detached — which sounds like a stutter at the start of
// every arch and nothing after it.
//
// The same shape as the pedal spans next door, and for the same reason: what the mark
// means is "from here to there", not "this note".

export type SlurSpan = {
    // Whole notes from the top of the piece: the first note under the arch, and the last.
    from: number;
    to: number;
    // The staff the arch is drawn on, numbered as the engraver numbers staves. An arch
    // belongs to one hand: a slur over the right hand's tune says nothing about the left
    // hand's staccato bass under it, and a span without a staff joins every hand.
    staff?: number;
};

const EPSILON = 1 / 1024;

// Whether a note written at `whole` on `staff` is joined to the note after it.
//
// Closed at the start and OPEN at the end: the first note under an arch is joined onward,
// and the last one is not — it is where the phrase stops, and holding it over would smear
// the join into whatever follows the slur. A note whose staff is unknown, or a span that
// names none, matches on time alone.
export function slurredOnwardAt(
    spans: readonly SlurSpan[],
    whole: number,
    staff?: number,
): boolean {
    return spans.some(
        (span) =>
            (span.staff === undefined || staff === undefined || span.staff === staff) &&
            whole >= span.from - EPSILON &&
            whole < span.to - EPSILON,
    );
}
