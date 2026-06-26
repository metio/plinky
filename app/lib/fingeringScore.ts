// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Hand, fingerPositions, isBlackKey, positionsCost } from "./fingering";

// Why a flagged position is awkward, drawn from the dominant cost penalty — the
// teaching point behind the suggestion. "general" is the catch-all (e.g. a stretch).
export type FingerReason = "thumbBlack" | "repeat" | "general";

// The leading voice that carries movement: top note for the right hand, bottom
// for the left.
function lead(position: number[], hand: Hand): number {
    return hand === "right" ? position.length - 1 : 0;
}

// Identifies the most teachable problem with the player's fingering at one
// position, so the trainer can say *why*, not just "use this finger".
export function reasonFor(
    positions: number[][],
    fingers: number[][],
    index: number,
    hand: Hand,
): FingerReason {
    const pitches = positions[index]!;
    const chosen = fingers[index]!;
    for (let i = 0; i < pitches.length; i++) {
        if (chosen[i] === 1 && isBlackKey(pitches[i]!)) {
            return "thumbBlack";
        }
    }
    if (index > 0) {
        const here = lead(pitches, hand);
        const prev = lead(positions[index - 1]!, hand);
        if (
            chosen[here] === fingers[index - 1]![prev] &&
            pitches[here] !== positions[index - 1]![prev]
        ) {
            return "repeat";
        }
    }
    return "general";
}

// A position is worth flagging only if re-fingering it to the suggestion meaningfully
// lowers the effort — so a different-but-comfortable choice is left alone.
const IMPROVE_THRESHOLD = 1;

export type FingeringResult = {
    // The chooser's optimum, one finger per note per position, for the reveal.
    suggested: number[][];
    // How close the player's effort is to the optimum, 0..1 (1 = as good or better).
    efficiency: number;
    // Indices of positions that would genuinely play easier re-fingered.
    reconsider: number[];
};

function sameFingers(a: number[], b: number[] | undefined): boolean {
    return b !== undefined && a.length === b.length && a.every((finger, i) => finger === b[i]);
}

// Scores a player's fingering of a sequence of positions (notes and chords) by
// effort rather than by matching the chooser's path: a choice that costs about
// the same as the optimum is judged just as good.
export function scoreFingering(
    positions: number[][],
    fingers: number[][],
    hand: Hand,
    span?: number,
): FingeringResult {
    const suggested = fingerPositions(positions, hand, span);
    const optimalCost = positionsCost(positions, suggested, hand, span);
    const userCost = positionsCost(positions, fingers, hand, span);
    const efficiency = userCost <= optimalCost ? 1 : optimalCost / userCost;

    const reconsider: number[] = [];
    for (let i = 0; i < positions.length; i++) {
        if (sameFingers(fingers[i]!, suggested[i])) {
            continue;
        }
        const swapped = fingers.map((tuple, j) => (j === i ? suggested[i]! : tuple));
        if (userCost - positionsCost(positions, swapped, hand, span) > IMPROVE_THRESHOLD) {
            reconsider.push(i);
        }
    }
    return { suggested, efficiency, reconsider };
}
