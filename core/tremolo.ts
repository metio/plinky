// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The notes a tremolo actually sounds.
//
// A tremolo is written as a shorthand — one note (or two) with slashes through the stem —
// standing for a rapid repetition that would be tedious to engrave in full. Printed but not
// played, the page and the sound disagree about what the bar contains, and a reader learning
// to recognise the sign hears a plain long note where the score asks for a shimmer. 135
// pieces in the catalogue write one.
//
// Two forms, and the alternating one is the common one on a piano: 2560 of the catalogue's
// marks against 1105 single-note. A single-note tremolo repeats its own note; an alternating
// one rocks between two written chords, which is the bass figure under half the nineteenth
// century.
//
// This is the same deliberate divergence the ornaments already have: Listen plays the
// figure, and the graded run asks for the written note. Nobody can be graded on a tremolo
// note by note, and demanding it would fail every player who plays the passage beautifully.

// How many slashes through the stem, and what each means. One slash repeats in quavers, two
// in semiquavers, three in demisemiquavers — each slash halves the note again. So a
// repetition lasts 2^-beams quarter notes.
export function tremoloUnitQuarters(beams: number): number {
    // A mark outside 1..4 is not something the notation can express; clamped rather than
    // trusted, since the result divides a duration and a zero would not end.
    const slashes = Math.max(1, Math.min(4, Math.round(beams)));
    return 2 ** -slashes;
}

// The most notes one tremolo may become.
//
// A demisemiquaver tremolo across a whole note is 32 notes, which is ordinary; four slashes
// across a long fermata-stretched note could ask for hundreds, and every one of them is a
// scheduled voice. Past this the ear cannot follow the individual notes anyway, so they are
// made longer rather than more numerous — the shimmer is the same and the machine survives.
const MOST_NOTES = 64;

export type TremoloNote = { pitches: number[]; quarters: number };

// The figure, filling exactly the time the written note (or pair) had.
//
// `second` is the other chord of an alternating tremolo, and null for a single-note one.
// Both chords keep all their pitches: a tremolo between two octaves is two octaves rocking,
// not two single notes.
// `phase` is how many repetitions of the figure have already sounded before this stretch of
// it, so a rock resumed part-way through a span carries on from the chord it had reached
// rather than starting over on the first.
export function tremoloNotes(
    first: readonly number[],
    second: readonly number[] | null,
    quarters: number,
    beams: number,
    phase = 0,
): TremoloNote[] {
    if (first.length === 0 || quarters <= 0) {
        return [];
    }
    const unit = tremoloUnitQuarters(beams);
    // At least two, or it is not a repetition of anything. Rounded, because the written
    // duration and the repetition rate need not divide exactly — a tremolo over a dotted
    // note is the ordinary case.
    const wanted = Math.max(2, Math.round(quarters / unit));
    const count = Math.min(MOST_NOTES, wanted);
    // Spread over the real duration rather than at the nominal unit, so the figure ends
    // exactly where the note did however the rounding fell. A tremolo that overran would
    // push the next note late; one that fell short would leave a hole in the bar.
    const each = quarters / count;
    const alternate = second !== null && second.length > 0;
    return Array.from({ length: count }, (_, index) => ({
        pitches: [...(alternate && (index + phase) % 2 === 1 ? second : first)],
        quarters: each,
    }));
}

// Where the piece asks for a tremolo, read off the file's own notes.
//
// `to` is where the figure ends, and for an alternating tremolo that is the end of the
// SECOND written note — the pair is one gesture occupying both their durations, and the
// notes are rocked between rather than played one after the other.
// One WRITTEN note of a tremolo, and what it shakes against.
//
// An alternating tremolo yields two of these — one per written note — each covering its own
// note's time, and both spelling the same alternation in the same order. Concatenated that
// is one unbroken rock between the two chords, and it means nothing has to reach across
// positions or suppress one: a spelling that swallowed the second note's position would
// swallow whatever the OTHER hand was playing there too.
export type TremoloSpan = {
    from: number;
    to: number;
    beams: number;
    // The chord that carries the mark where the span opens — the notes the tremolo rocks,
    // as MIDI numbers. Another staff's note struck at the same onset is not among them, and
    // sounds once while these shake.
    pitches: number[];
    // The two chords being rocked between, in the order the score writes them, or null for a
    // single-note tremolo. Both spans of a pair carry the same value, so both spell the same
    // figure.
    //
    // The pitches are carried rather than looked up later because the second chord is a
    // LATER position in the walk: whatever spells the first one out cannot see it. Each
    // comes with where it is written, so a caller can apply whatever octave line is in force
    // there — the two positions need not be under the same one.
    pair: { at: number; pitches: number[] }[] | null;
};

export function readTremolos(
    notes: readonly {
        whole: number;
        wholes: number;
        midi: number | null;
        // The staff and voice the note sits in: a tremolo rocks the chord that carries the
        // mark, and the other hand's note struck at the same onset is not part of it.
        staff?: number;
        voice?: string;
        marks: { tremolo: { beams: number; part: "single" | "start" | "stop" } | null };
    }[],
): TremoloSpan[] {
    const spans: TremoloSpan[] = [];
    const chordAt = (whole: number, staff?: number, voice?: string) =>
        notes
            .filter(
                (one) =>
                    one.whole === whole &&
                    one.midi !== null &&
                    one.staff === staff &&
                    one.voice === voice,
            )
            .map((one) => one.midi as number);
    // A tremolo opened and waiting for the note it rocks against. Held rather than paired by
    // position, because every note of a chord carries the mark and only one figure is meant.
    let open: {
        at: number;
        wholes: number;
        beams: number;
        staff?: number;
        voice?: string;
    } | null = null;
    for (const note of notes) {
        const mark = note.marks.tremolo;
        if (!mark || note.midi === null) {
            continue;
        }
        if (spans.some((span) => span.from === note.whole)) {
            continue;
        }
        if (mark.part === "single") {
            spans.push({
                from: note.whole,
                to: note.whole + note.wholes,
                beams: mark.beams,
                pitches: chordAt(note.whole, note.staff, note.voice),
                pair: null,
            });
        } else if (mark.part === "start") {
            open ??= {
                at: note.whole,
                wholes: note.wholes,
                beams: mark.beams,
                staff: note.staff,
                voice: note.voice,
            };
        } else if (open !== null && note.whole > open.at) {
            const start = { at: open.at, pitches: chordAt(open.at, open.staff, open.voice) };
            const stop = { at: note.whole, pitches: chordAt(note.whole, note.staff, note.voice) };
            const pair = [start, stop];
            // One span per written note, each over its own time, both spelling the same
            // alternation — so the two run together into one unbroken figure.
            spans.push({
                from: open.at,
                to: open.at + open.wholes,
                beams: open.beams,
                pitches: start.pitches,
                pair,
            });
            spans.push({
                from: note.whole,
                to: note.whole + note.wholes,
                beams: open.beams,
                pitches: stop.pitches,
                pair,
            });
            open = null;
        }
    }
    return spans;
}
