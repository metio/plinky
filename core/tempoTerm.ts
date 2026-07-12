// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The classical Italian tempo term for a metronome mark, so a speed reads as
// music ("Allegro"), not just arithmetic. The terms are the universal vocabulary
// printed on scores in every country, so they are deliberately untranslated.
// Boundaries follow the conventional metronome ranges.
const TERMS: Array<{ below: number; term: string }> = [
    { below: 40, term: "Grave" },
    { below: 60, term: "Largo" },
    { below: 76, term: "Adagio" },
    { below: 108, term: "Andante" },
    { below: 120, term: "Moderato" },
    { below: 156, term: "Allegro" },
    { below: 176, term: "Vivace" },
    { below: Number.POSITIVE_INFINITY, term: "Presto" },
];

export function tempoTerm(bpm: number): string {
    const found = TERMS.find((entry) => bpm < entry.below);
    return (found ?? TERMS[TERMS.length - 1]!).term;
}
