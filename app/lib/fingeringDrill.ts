// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// C-major degrees from C4 to C6, the pool a right-hand drill walks. Spanning more
// than an octave means a five-finger position can't cover it, so the line forces
// real fingering decisions (position shifts, thumb-passes).
const POOL = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];

// Mostly steps with the odd small leap, biased to keep moving rather than sit.
const MOVES = [-2, -1, -1, 1, 1, 2, 2, 3];

// Roughly this share of positions thicken into a chord, so a drill mixes single
// notes with simultaneous notes that must be fingered together.
const CHORD_CHANCE = 0.4;

// A sequence of positions (each a sorted-ascending pitch set: a single note or a
// chord). The top note carries a melodic walk; some positions stack diatonic
// thirds beneath it into a chord the hand must shape at once. The rng is
// injectable so a run can be reproduced in tests.
export function generateDrill(rng: () => number = Math.random, length = 8): number[][] {
    let index = Math.floor(rng() * 4); // start in the lower third
    const positions: number[][] = [];
    for (let i = 0; i < length; i++) {
        if (i > 0) {
            const move = MOVES[Math.floor(rng() * MOVES.length)] ?? 1;
            index = Math.max(0, Math.min(POOL.length - 1, index + move));
        }
        // Stack diatonic thirds below the top note when there's room for them.
        if (index >= 2 && rng() < CHORD_CHANCE) {
            const tones = [index - 4, index - 2, index].filter((j) => j >= 0).map((j) => POOL[j]!);
            positions.push(tones);
        } else {
            positions.push([POOL[index]!]);
        }
    }
    return positions;
}
