// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// C-major degrees from C4 to C6, the pool a right-hand drill line walks. Spanning
// more than an octave means a five-finger position can't cover it, so the line
// forces real fingering decisions (position shifts, thumb-passes).
const POOL = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];

// Mostly steps with the odd small leap, biased to keep moving rather than sit —
// enough variety that where you put each finger matters. The rng is injectable so
// a run can be reproduced in tests.
const MOVES = [-2, -1, -1, 1, 1, 2, 2, 3];

export function generateDrill(rng: () => number = Math.random, length = 8): number[] {
    let index = Math.floor(rng() * 4); // start in the lower third
    const line = [POOL[index]!];
    for (let i = 1; i < length; i++) {
        const move = MOVES[Math.floor(rng() * MOVES.length)] ?? 1;
        index = Math.max(0, Math.min(POOL.length - 1, index + move));
        line.push(POOL[index]!);
    }
    return line;
}
