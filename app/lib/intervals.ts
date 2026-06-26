// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Friendly names for an interval size in semitones, used to gloss a measured hand
// reach (e.g. 9 → "a major sixth"). English-only for now; the semitone count is
// the precise, language-neutral value shown alongside it.
const NAMES = [
    "a unison",
    "a minor second",
    "a major second",
    "a minor third",
    "a major third",
    "a perfect fourth",
    "a tritone",
    "a perfect fifth",
    "a minor sixth",
    "a major sixth",
    "a minor seventh",
    "a major seventh",
    "an octave",
];

export function intervalName(semitones: number): string {
    const n = Math.abs(Math.round(semitones));
    if (n <= 12) {
        return NAMES[n] ?? `${n} semitones`;
    }
    if (n === 24) {
        return "two octaves";
    }
    if (n < 24) {
        return `an octave and ${NAMES[n - 12]}`;
    }
    return `${n} semitones`;
}
