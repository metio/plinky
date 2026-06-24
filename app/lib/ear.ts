// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The pool the ear trainer draws from: one octave of C major, C4–C5.
export const EAR_NOTES = [60, 62, 64, 65, 67, 69, 71, 72];

// Pick the next target, avoiding an immediate repeat so two rounds never sound
// identical. The rng is injectable for deterministic tests.
export function nextEarNote(rng: () => number, previous?: number): number {
    const pool = previous === undefined ? EAR_NOTES : EAR_NOTES.filter((note) => note !== previous);
    return pool[Math.floor(rng() * pool.length)]!;
}
