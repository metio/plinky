// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { packToCode, unpackFromCode } from "./shareCode";

// A "ghost": the note onset times of a completed run on a score, each in ms from
// the run's first note, ascending. Replaying the clock against these lets a later
// attempt race the earlier one, Mario-Kart style. The shape is plain JSON so the
// same recording can later be shared with a friend to race against.

// The onsets ascend, so the gaps between them are small non-negative numbers that
// compress far better than the absolute times — a long piece's thousands of onsets
// would otherwise blow a shared URL past what messaging apps and link unfurlers
// accept. The first gap is measured from zero.
function toGaps(onsets: number[]): number[] {
    const gaps: number[] = [];
    let previous = 0;
    for (const onset of onsets) {
        const rounded = Math.round(onset);
        gaps.push(rounded - previous);
        previous = rounded;
    }
    return gaps;
}

function fromGaps(gaps: number[]): number[] {
    const onsets: number[] = [];
    let running = 0;
    for (const gap of gaps) {
        running += gap;
        onsets.push(running);
    }
    return onsets;
}

function isAscending(onsets: number[]): boolean {
    for (let i = 1; i < onsets.length; i++) {
        if (onsets[i]! < onsets[i - 1]!) {
            return false;
        }
    }
    return true;
}

// A ghost packed for a URL — the inter-onset gaps through the shared compress-and-
// base64url codec, so even a long piece stays within a shareable link length.
export function encodeGhost(onsets: number[]): string {
    return packToCode(toGaps(onsets));
}

// Parse a shared ghost, rejecting anything that isn't a run of ascending numbers.
export function decodeGhost(code: string): number[] | null {
    if (!code) {
        return null;
    }
    const unpacked = unpackFromCode(code);
    if (
        !Array.isArray(unpacked) ||
        !unpacked.every((gap) => typeof gap === "number" && Number.isFinite(gap))
    ) {
        return null;
    }
    const onsets = fromGaps(unpacked);
    return isAscending(onsets) ? onsets : null;
}

// How many notes the ghost has reached by a given elapsed time. The onsets ascend,
// so the first one still in the future ends the count.
export function ghostReached(onsets: number[], elapsedMs: number): number {
    let reached = 0;
    for (const onset of onsets) {
        if (onset > elapsedMs) {
            break;
        }
        reached += 1;
    }
    return reached;
}
