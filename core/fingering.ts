// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

// How much of a movement's geometric cost the player actually pays, given how long they
// have before the next position must sound.
//
// Reach and stretch are properties of the hand and cost what they cost. Movement is not:
// a twelfth in a slow left-hand accompaniment is a comfortable swing the arm makes at
// leisure, while the same interval between two sixteenths is a genuine hazard. Charging
// both alike is what put Satie's Gymnopédies — slow, wide, and reachable in a player's
// first years — above every Chopin étude in the catalogue.
//
// Below MOVE_URGENT_SECONDS there is no preparation time and the movement costs what its
// geometry says. Beyond it the charge falls off as the reciprocal of the time available,
// down to MOVE_EASE_FLOOR: however long the player has, the hand still has to arrive on
// the right key, so time makes a leap cheap and never free.
export const MOVE_URGENT_SECONDS = 0.25;
export const MOVE_EASE_FLOOR = 0.1;

export function moveEase(gap: number): number {
    if (!Number.isFinite(gap) || gap <= MOVE_URGENT_SECONDS) {
        return 1;
    }
    return Math.max(MOVE_EASE_FLOOR, MOVE_URGENT_SECONDS / gap);
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
//
// A Viterbi search: at each pitch the cheapest way of arriving on each finger, and which
// finger it came from. The path is read back off those pointers at the end rather than
// carried along, so a line of n notes costs n steps of work and not n² of copying. Ties
// go to the earlier finger at every choice, which is what decides between two fingerings
// of equal comfort — and the catalogue's costs were measured with exactly that choice.
export function fingerLine(pitches: number[], hand: Hand, span?: number): number[] {
    if (pitches.length === 0) {
        return [];
    }
    const { spread, leap } = handModel(span);
    let costs = FINGERS.map((finger) => startCost(pitches[0]!, finger));
    const from: number[][] = [];
    for (let i = 1; i < pitches.length; i++) {
        const back: number[] = [];
        costs = FINGERS.map((finger, at) => {
            let best = Number.POSITIVE_INFINITY;
            back[at] = 0;
            costs.forEach((previous, index) => {
                const cost =
                    previous +
                    transitionCost(
                        pitches[i - 1]!,
                        FINGERS[index]!,
                        pitches[i]!,
                        finger,
                        hand,
                        spread,
                        leap,
                    );
                if (cost < best) {
                    best = cost;
                    back[at] = index;
                }
            });
            return best;
        });
        from.push(back);
    }
    return readBack(costs, from).map((state) => FINGERS[state]!);
}

// The states along the cheapest path, first to last, given each step's back pointers.
function readBack(finalCosts: number[], from: number[][]): number[] {
    let state = finalCosts.reduce(
        (best, cost, index) => (cost < finalCosts[best]! ? index : best),
        0,
    );
    const states = [state];
    for (let i = from.length - 1; i >= 0; i--) {
        state = from[i]![state]!;
        states.push(state);
    }
    return states.reverse();
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
// right hand, the bottom for the left. A position with no pitches has no voice to
// lead, so it reports -1 and the movement across it is skipped rather than costed
// against an absent note.
function anchor(pitches: number[], hand: Hand): number {
    return pitches.length === 0 ? -1 : hand === "right" ? pitches.length - 1 : 0;
}

// The cost of moving between two positions, or 0 when either holds no notes — an
// empty position is silence, and silence neither helps nor hinders the hand.
function moveCost(
    from: number[],
    fromFingers: number[],
    to: number[],
    toFingers: number[],
    hand: Hand,
    spread: Record<number, number>,
    leap: number,
): number {
    const a = anchor(from, hand);
    const b = anchor(to, hand);
    if (a < 0 || b < 0) {
        return 0;
    }
    return transitionCost(from[a]!, fromFingers[a]!, to[b]!, toFingers[b]!, hand, spread, leap);
}

// The comfort cost of fingering a whole sequence of positions a given way — chord
// shapes plus the movement of the leading voice between them.
export function positionsCost(
    positions: number[][],
    fingers: number[][],
    hand: Hand,
    span?: number,
    // Seconds between position i-1 and position i, where the caller knows them. Omitted,
    // every movement is charged as though it had to happen at once — which is what the
    // fingering trainer wants, since it advises on shape rather than on tempo.
    gaps?: number[],
): number {
    if (positions.length === 0) {
        return 0;
    }
    const { spread, leap } = handModel(span);
    let cost = chordCost(positions[0]!, fingers[0]!, spread);
    for (let i = 1; i < positions.length; i++) {
        cost += chordCost(positions[i]!, fingers[i]!, spread);
        cost +=
            moveCost(
                positions[i - 1]!,
                fingers[i - 1]!,
                positions[i]!,
                fingers[i]!,
                hand,
                spread,
                leap,
            ) * (gaps === undefined ? 1 : moveEase(gaps[i] ?? 0));
    }
    return cost;
}

// The most comfortable fingering for a sequence of positions, via the same search as
// the single line but with chord shapes as the per-position states.
export function fingerPositions(
    positions: number[][],
    hand: Hand,
    span?: number,
    gaps?: number[],
): number[][] {
    if (positions.length === 0) {
        return [];
    }
    const { spread, leap } = handModel(span);
    let shapes = fingerSets(positions[0]!.length, hand);
    let costs = shapes.map((fingers) => chordCost(positions[0]!, fingers, spread));
    const chosen: number[][][] = [shapes];
    const from: number[][] = [];
    for (let i = 1; i < positions.length; i++) {
        const pos = positions[i]!;
        const prevPos = positions[i - 1]!;
        const ease = gaps === undefined ? 1 : moveEase(gaps[i] ?? 0);
        const previousShapes = shapes;
        const previousCosts = costs;
        const back: number[] = [];
        shapes = fingerSets(pos.length, hand);
        costs = shapes.map((fingers, at) => {
            let best = Number.POSITIVE_INFINITY;
            back[at] = 0;
            previousCosts.forEach((previous, index) => {
                const cost =
                    previous +
                    chordCost(pos, fingers, spread) +
                    moveCost(prevPos, previousShapes[index]!, pos, fingers, hand, spread, leap) *
                        ease;
                if (cost < best) {
                    best = cost;
                    back[at] = index;
                }
            });
            return best;
        });
        chosen.push(shapes);
        from.push(back);
    }
    return readBack(costs, from).map((state, i) => chosen[i]![state]!);
}
