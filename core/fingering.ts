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

// The thumb-to-pinky reach the default spread assumes. A measured hand span
// scales the model relative to it: a larger hand spreads wider and tolerates
// bigger leaps before they cost, a smaller hand the reverse.
const DEFAULT_SPAN = 9;

// A leap wider than this many semitones is extra costly; scaled with the hand.
const BASE_LEAP = 7;

function scaledSpread(scale: number): Record<number, number> {
    return {
        1: 0,
        2: SPREAD[2]! * scale,
        3: SPREAD[3]! * scale,
        4: SPREAD[4]! * scale,
        5: SPREAD[5]! * scale,
    };
}

// The finger-spread table and leap tolerance for a given reach (or the defaults
// when no span is measured). Shared by the chooser and the cost scorer so both
// judge a fingering against the same hand.
function handModel(span?: number): { spread: Record<number, number>; leap: number } {
    const scale = span && span > 0 ? span / DEFAULT_SPAN : 1;
    return { spread: scale === 1 ? SPREAD : scaledSpread(scale), leap: BASE_LEAP * scale };
}

export function isBlackKey(pitch: number): boolean {
    return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}

function startCost(pitch: number, finger: number): number {
    return finger === 1 && isBlackKey(pitch) ? 2 : 0;
}

function transitionCost(
    p1: number,
    f1: number,
    p2: number,
    f2: number,
    hand: Hand,
    spread: Record<number, number>,
    leap: number,
): number {
    const direction = hand === "right" ? 1 : -1;
    // The pitch change expected if the hand stays in place: for the right hand a
    // higher finger plays a higher note, mirrored for the left.
    const expected = direction * (spread[f2]! - spread[f1]!);
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
    if (shift > leap) {
        cost += shift; // large leaps are extra costly
    }
    return Math.max(0, cost);
}

// Finger a single melodic line, returning a finger (1..5) per pitch. An optional
// hand span (semitones) personalizes the cost to the player's reach.
export function fingerLine(pitches: number[], hand: Hand, span?: number): number[] {
    if (pitches.length === 0) {
        return [];
    }
    const { spread, leap } = handModel(span);
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
                    transitionCost(
                        pitches[i - 1]!,
                        FINGERS[index]!,
                        pitches[i]!,
                        finger,
                        hand,
                        spread,
                        leap,
                    );
                if (cost < best.cost) {
                    best = { cost, path: [...previous.path, finger] };
                }
            });
            return best;
        });
    }
    return paths.reduce((best, candidate) => (candidate.cost < best.cost ? candidate : best)).path;
}

// The comfort cost of a specific finger assignment for a line — the same effort
// the chooser minimizes. Lets a trainer score the player's own fingering against
// the optimum by effort, so a different-but-comfortable choice still scores well.
export function fingeringCost(
    pitches: number[],
    fingers: number[],
    hand: Hand,
    span?: number,
): number {
    if (pitches.length === 0) {
        return 0;
    }
    const { spread, leap } = handModel(span);
    let cost = startCost(pitches[0]!, fingers[0]!);
    for (let i = 1; i < pitches.length; i++) {
        cost += transitionCost(
            pitches[i - 1]!,
            fingers[i - 1]!,
            pitches[i]!,
            fingers[i]!,
            hand,
            spread,
            leap,
        );
    }
    return cost;
}

// Finger a hand's steps, using each step's melody note (the highest note for the
// right hand, the lowest for the left) as the line to finger.
export function fingerSteps(steps: { pitches: number[] }[], hand: Hand, span?: number): number[] {
    // A step with no pitches has no note to finger; including it would feed
    // ±Infinity (from an empty Math.max/Math.min) into the cost model and
    // collapse the whole line to NaN costs.
    const line = steps
        .filter((step) => step.pitches.length > 0)
        .map((step) => (hand === "right" ? Math.max(...step.pitches) : Math.min(...step.pitches)));
    return fingerLine(line, hand, span);
}

// --- Chord-aware fingering ---------------------------------------------------
// A "position" is the set of pitches sounding together (one note, or a chord),
// sorted ascending. Each gets one finger per note. The line API above is the
// single-note special case; this handles simultaneous notes the trainer needs.

// The candidate finger tuples for a k-note chord, aligned to ascending pitch:
// ascending fingers for the right hand, descending for the left (whose thumb
// takes the top note). Fingers within a chord are distinct and never cross.
function fingerSets(count: number, hand: Hand): number[][] {
    // More notes than fingers (a dense or two-hand-on-one-staff voicing real music
    // has) can't be fingered cleanly; rather than yield no tuple — which would leave
    // the position unfingered and break the cost walk — spread the five fingers and
    // double the outer one on the extras. Length stays aligned to the pitches.
    if (count > 5) {
        const ascending = Array.from({ length: count }, (_, i) => Math.min(i + 1, 5));
        return [hand === "right" ? ascending : ascending.map((finger) => 6 - finger)];
    }
    const sets: number[][] = [];
    const pick = (start: number, acc: number[]) => {
        if (acc.length === count) {
            sets.push(hand === "right" ? acc : [...acc].reverse());
            return;
        }
        for (let finger = start; finger <= 5; finger++) {
            pick(finger + 1, [...acc, finger]);
        }
    };
    pick(1, []);
    return sets;
}

// How awkward one chord shape is: a thumb on a black key, plus how far each
// adjacent pitch gap departs from the natural spread of the fingers holding it.
function chordCost(pitches: number[], fingers: number[], spread: Record<number, number>): number {
    let cost = 0;
    for (let i = 0; i < pitches.length; i++) {
        if (fingers[i] === 1 && isBlackKey(pitches[i]!)) {
            cost += 2;
        }
    }
    for (let i = 1; i < pitches.length; i++) {
        const interval = pitches[i]! - pitches[i - 1]!;
        const reach = Math.abs(spread[fingers[i]!]! - spread[fingers[i - 1]!]!);
        cost += Math.abs(interval - reach);
    }
    return cost;
}

// The voice that leads hand movement between positions: the top note for the
// right hand, the bottom for the left.
function anchor(pitches: number[], hand: Hand): number {
    return hand === "right" ? pitches.length - 1 : 0;
}

// The comfort cost of fingering a whole sequence of positions a given way — chord
// shapes plus the movement of the leading voice between them.
export function positionsCost(
    positions: number[][],
    fingers: number[][],
    hand: Hand,
    span?: number,
): number {
    if (positions.length === 0) {
        return 0;
    }
    const { spread, leap } = handModel(span);
    let cost = chordCost(positions[0]!, fingers[0]!, spread);
    for (let i = 1; i < positions.length; i++) {
        cost += chordCost(positions[i]!, fingers[i]!, spread);
        const from = anchor(positions[i - 1]!, hand);
        const to = anchor(positions[i]!, hand);
        cost += transitionCost(
            positions[i - 1]![from]!,
            fingers[i - 1]![from]!,
            positions[i]![to]!,
            fingers[i]![to]!,
            hand,
            spread,
            leap,
        );
    }
    return cost;
}

// The most comfortable fingering for a sequence of positions, via the same DP as
// the single line but with chord shapes as the per-position states.
export function fingerPositions(positions: number[][], hand: Hand, span?: number): number[][] {
    if (positions.length === 0) {
        return [];
    }
    const { spread, leap } = handModel(span);
    type Path = { fingers: number[]; cost: number; path: number[][] };
    let paths: Path[] = fingerSets(positions[0]!.length, hand).map((fingers) => ({
        fingers,
        cost: chordCost(positions[0]!, fingers, spread),
        path: [fingers],
    }));
    for (let i = 1; i < positions.length; i++) {
        const pos = positions[i]!;
        const prevPos = positions[i - 1]!;
        const from = anchor(prevPos, hand);
        const to = anchor(pos, hand);
        paths = fingerSets(pos.length, hand).map((fingers) => {
            let best: Path = { fingers, cost: Number.POSITIVE_INFINITY, path: [] };
            for (const previous of paths) {
                const cost =
                    previous.cost +
                    chordCost(pos, fingers, spread) +
                    transitionCost(
                        prevPos[from]!,
                        previous.fingers[from]!,
                        pos[to]!,
                        fingers[to]!,
                        hand,
                        spread,
                        leap,
                    );
                if (cost < best.cost) {
                    best = { fingers, cost, path: [...previous.path, fingers] };
                }
            }
            return best;
        });
    }
    return paths.reduce((best, candidate) => (candidate.cost < best.cost ? candidate : best)).path;
}
