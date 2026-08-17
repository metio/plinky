// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which keys the player's instrument actually has, and what to do about a piece that
// reaches past them.
//
// The catalogue is written for a full piano, because that is what the scores were
// engraved for. Most people learning at home are not sitting at one: a 61-key controller
// stops at C2 and C7, and a piece dipping to a low F simply has no key to press. Nothing
// in MIDI says so — a device reports a name and a manufacturer and never its key count —
// so the range has to be measured, guessed from that name, or assumed.
//
// The answer to a piece that does not fit is to move the whole piece by whole octaves.
// Every interval, every hand shape and all the fingering survive an octave; the piece
// simply sits lower. Moving only the notes that overflow would be cheaper and would break
// the line exactly where it is being read, so it is not offered.
//
// Distinct from two neighbours it is easy to confuse: keyboardRange.ts frames the
// ON-SCREEN keybed around a piece, and prefs' handSpan is how far a hand stretches. This
// is the instrument in the room.

// The lowest and highest MIDI note the instrument has, inclusive.
export type InstrumentRange = { from: number; to: number };

// A0 to C8 — the full piano, what the scores assume, and the assumption when nothing
// better is known.
export const FULL_PIANO: InstrumentRange = { from: 21, to: 108 };

// The sizes keyboards are actually sold in, each with the span the makers ship it as.
// Anything else is measured rather than guessed; this list exists only to read a size off
// a device's own name.
export const STANDARD_SIZES: readonly { keys: number; range: InstrumentRange }[] = [
    { keys: 88, range: { from: 21, to: 108 } }, // A0–C8
    { keys: 76, range: { from: 28, to: 103 } }, // E1–G7
    { keys: 61, range: { from: 36, to: 96 } }, // C2–C7
    { keys: 49, range: { from: 36, to: 84 } }, // C2–C6
    { keys: 37, range: { from: 36, to: 72 } }, // C2–C5
    { keys: 25, range: { from: 48, to: 72 } }, // C3–C5
];

export function keysIn(range: InstrumentRange): number {
    return range.to - range.from + 1;
}

export function isFullPiano(range: InstrumentRange): boolean {
    return range.from <= FULL_PIANO.from && range.to >= FULL_PIANO.to;
}

// Reads a key count off a device's name — "Keystation 61 MK3" is a 61-key keyboard, and
// says so where nothing else will.
//
// Only the standard sizes count, and only as whole numbers: the digits either side matter
// because "PX-S1100" and "FP-30X" carry numbers that are not key counts, and a loose match
// would read the 25 out of an 1100 and shrink somebody's grand piano to two octaves. A
// guess this narrow is either right or absent.
export function sizeFromName(name: string): InstrumentRange | null {
    const sizes = STANDARD_SIZES.map((size) => size.keys).join("|");
    const found = name.match(new RegExp(`(?<![0-9])(${sizes})(?![0-9])`));
    if (!found) {
        return null;
    }
    const keys = Number(found[1]);
    return STANDARD_SIZES.find((size) => size.keys === keys)?.range ?? null;
}

// The range in force: what the player set, else what a connected instrument's name gives
// away, else the full piano.
//
// A name-derived range is deliberately never written down. It costs nothing to derive
// again, it corrects itself the moment a different instrument is plugged in, and a stored
// guess would outlive the keyboard it was guessed from — the setting the player sees is
// then the one actually in effect, rather than a saved opinion about a keyboard they no
// longer own.
export function effectiveRange(
    stored: InstrumentRange | null,
    deviceNames: readonly string[] = [],
): InstrumentRange {
    if (stored) {
        return stored;
    }
    // With two instruments connected, the reach is the widest of them: the player can
    // reach any key either one has.
    const guessed = deviceNames.map(sizeFromName).filter((range) => range !== null);
    if (guessed.length === 0) {
        return FULL_PIANO;
    }
    return {
        from: Math.min(...guessed.map((range) => range.from)),
        to: Math.max(...guessed.map((range) => range.to)),
    };
}

// The span a set of pitches covers, or null when there are none to cover.
export function pitchRange(pitches: readonly number[]): InstrumentRange | null {
    if (pitches.length === 0) {
        return null;
    }
    return { from: Math.min(...pitches), to: Math.max(...pitches) };
}

// What can be done about this piece on this instrument: nothing (it fits), move it by
// whole octaves, or nothing that helps.
export type RangeFit =
    | { kind: "fits"; shift: 0 }
    | { kind: "shifted"; shift: number }
    | { kind: "beyond"; shift: 0 };

export const FITS: RangeFit = { kind: "fits", shift: 0 };

// The smallest whole-octave move that brings a piece inside the instrument.
//
// The constraint is a pair of inequalities — the shift must lift the bottom note to at
// least the lowest key and keep the top note under the highest — so the feasible shifts
// are an interval, and the answer is the multiple of twelve nearest zero inside it. Two
// ways there is no answer: a piece spanning more than the instrument (no offset can
// contain it), and a piece that would fit somewhere in between but at no whole octave.
// Both are "beyond", because moving by anything other than an octave would change the
// piece rather than its register.
export function fitToInstrument(
    piece: InstrumentRange | null,
    instrument: InstrumentRange,
): RangeFit {
    if (!piece) {
        return FITS;
    }
    const atLeast = instrument.from - piece.from;
    const atMost = instrument.to - piece.to;
    if (atLeast <= 0 && atMost >= 0) {
        return FITS;
    }
    if (atLeast > atMost) {
        return { kind: "beyond", shift: 0 };
    }
    const shift = atLeast > 0 ? Math.ceil(atLeast / 12) * 12 : Math.floor(atMost / 12) * 12;
    if (shift < atLeast || shift > atMost) {
        return { kind: "beyond", shift: 0 };
    }
    return { kind: "shifted", shift };
}
