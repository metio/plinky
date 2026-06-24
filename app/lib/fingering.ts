// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A rule-based fingering suggester. Each note's finger (1 = thumb … 5 = pinky) is
// chosen by dynamic programming over a comfort cost: staying in position is
// cheap, passing the thumb to shift is allowed, and awkward stretches, repeated
// fingers, and thumbs on black keys are penalised. It suggests sensible fingering
// for scales and simple melodies, not a teacher's optimum.

export type Hand = "left" | "right";

const FINGERS = [1, 2, 3, 4, 5];

// Nominal spread of the fingers in semitones from the thumb, for a relaxed hand.
const SPREAD: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7 };

function isBlackKey(pitch: number): boolean {
    return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}

function startCost(pitch: number, finger: number): number {
    return finger === 1 && isBlackKey(pitch) ? 2 : 0;
}

function transitionCost(p1: number, f1: number, p2: number, f2: number, hand: Hand): number {
    const direction = hand === "right" ? 1 : -1;
    // The pitch change expected if the hand stays in place: for the right hand a
    // higher finger plays a higher note, mirrored for the left.
    const expected = direction * (SPREAD[f2]! - SPREAD[f1]!);
    const shift = Math.abs(p2 - p1 - expected);
    let cost = shift;

    if (f1 === f2) {
        cost += p1 === p2 ? 0 : 8; // a finger only repeats comfortably on a held note
    }

    // Passing the thumb is how the hand changes position: cheap in the natural
    // direction (thumb-under going one way, cross-over the other).
    const ascending = direction * (p2 - p1) > 0;
    if (f2 === 1 && f1 >= 3 && ascending) {
        cost -= 2;
    }
    if (f1 === 1 && f2 >= 3 && !ascending) {
        cost -= 2;
    }
    if (f2 === 1 && isBlackKey(p2)) {
        cost += 3;
    }
    if (shift > 7) {
        cost += shift; // large leaps are extra costly
    }
    return Math.max(0, cost);
}

// Finger a single melodic line, returning a finger (1..5) per pitch.
export function fingerLine(pitches: number[], hand: Hand): number[] {
    if (pitches.length === 0) {
        return [];
    }
    let paths = FINGERS.map((finger) => ({
        cost: startCost(pitches[0]!, finger),
        path: [finger],
    }));
    for (let i = 1; i < pitches.length; i++) {
        paths = FINGERS.map((finger) => {
            let best = { cost: Number.POSITIVE_INFINITY, path: [] as number[] };
            paths.forEach((previous, index) => {
                const cost =
                    previous.cost +
                    transitionCost(pitches[i - 1]!, FINGERS[index]!, pitches[i]!, finger, hand);
                if (cost < best.cost) {
                    best = { cost, path: [...previous.path, finger] };
                }
            });
            return best;
        });
    }
    return paths.reduce((best, candidate) => (candidate.cost < best.cost ? candidate : best)).path;
}

// Finger a hand's steps, using each step's melody note (the highest note for the
// right hand, the lowest for the left) as the line to finger.
export function fingerSteps(steps: { pitches: number[] }[], hand: Hand): number[] {
    const line = steps.map((step) =>
        hand === "right" ? Math.max(...step.pitches) : Math.min(...step.pitches),
    );
    return fingerLine(line, hand);
}
