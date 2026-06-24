// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Flow measures continuity — did the player keep moving like a musician rather
// than stopping to hunt for keys? The v1 model is the fraction of notes cleared
// first-try (no wrong note before them). A single stumble costs one note rather
// than collapsing the whole score, which a longest-streak ratio would do.
// Hesitation (long gaps) and streak weighting can enrich this later.
export function computeFlow(cleanFirstTry: boolean[]): number {
    if (cleanFirstTry.length === 0) {
        return 100;
    }
    const clean = cleanFirstTry.filter(Boolean).length;
    return (clean / cleanFirstTry.length) * 100;
}
