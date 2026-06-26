// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Hand, fingerLine, fingeringCost } from "./fingering";

// A note is worth flagging only if changing it to the suggested finger meaningfully
// lowers the effort — so a different-but-comfortable choice is left alone.
const IMPROVE_THRESHOLD = 1;

export type FingeringResult = {
    // The optimum the chooser would pick, for the reveal.
    suggested: number[];
    // How close the player's effort is to the optimum, 0..1 (1 = as good or better).
    efficiency: number;
    // Indices where adopting the suggested finger would genuinely play easier.
    reconsider: number[];
};

// Scores a player's fingering by effort rather than by matching the chooser's
// path: a choice that costs about the same as the optimum is judged just as good.
export function scoreFingering(
    pitches: number[],
    fingers: number[],
    hand: Hand,
    span?: number,
): FingeringResult {
    const suggested = fingerLine(pitches, hand, span);
    const optimalCost = fingeringCost(pitches, suggested, hand, span);
    const userCost = fingeringCost(pitches, fingers, hand, span);
    const efficiency = userCost <= optimalCost ? 1 : optimalCost / userCost;

    const reconsider: number[] = [];
    for (let i = 0; i < pitches.length; i++) {
        if (fingers[i] === suggested[i]) {
            continue;
        }
        const swapped = [...fingers];
        swapped[i] = suggested[i]!;
        if (userCost - fingeringCost(pitches, swapped, hand, span) > IMPROVE_THRESHOLD) {
            reconsider.push(i);
        }
    }
    return { suggested, efficiency, reconsider };
}
