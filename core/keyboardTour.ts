// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The first six things about a piano, for someone who has never touched one.
//
// Everything else in Plinky assumes the keyboard is already a thing you understand:
// that the black keys come in groups, that the white ones repeat, that a dot printed on
// a staff means one particular key under your hand. None of that is obvious, and none of
// it is written down anywhere in the app. This is that missing first hour, cut down to
// the six facts you cannot play a note without.
//
// Each step ends in a press, because reading about a keyboard teaches nobody. The first
// four need no notation at all — that is the point: nothing here assumes you can read
// music, so a complete beginner can finish four steps before meeting a staff.
//
// A press that is not the one asked for does nothing at all: no reset, no penalty, no
// counter of mistakes. Getting it wrong on a piano is how the piano gets learned, and a
// tour that punished a slip by restarting eight notes would teach the wrong lesson about
// what this app is.

// Middle C. The one landmark every other instruction is given relative to.
export const MIDDLE_C = 60;

// The tour's keyboard runs from middle C to the C above it, so a whole octave's pattern
// — two black keys, then three — is on screen at once without the keys becoming too
// small to hit on a phone. The bottom is MIDDLE_C itself.
export const TOUR_TO = MIDDLE_C + 12;

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function isBlackKey(note: number): boolean {
    return BLACK_PITCH_CLASSES.has(((note % 12) + 12) % 12);
}

// What a step waits for. "Any black key" lets the first step be satisfied by whichever
// one the reader's finger finds, which is the whole idea of that step — the group, not a
// particular note.
export type TourTarget = { kind: "anyBlack" } | { kind: "note"; note: number };

export type TourStepId =
    | "blackGroups"
    | "middleC"
    | "whiteRun"
    | "blackNames"
    | "noteToKey"
    | "highLow";

export type TourStep = {
    id: TourStepId;
    // The keys the step draws attention to, lit on the keyboard while it is open.
    highlight: number[];
    // What must be played to move on, in order.
    play: TourTarget[];
    // The pitches this step shows on a staff, if any. The first four steps show none:
    // a beginner meets the keyboard before they meet notation.
    staff?: number[];
};

const WHITE_OCTAVE = [0, 2, 4, 5, 7, 9, 11, 12].map((step) => MIDDLE_C + step);

export const TOUR_STEPS: TourStep[] = [
    // The pattern first: the black keys are what make a piano readable at a glance, and
    // "two, then three" is the fact everything else hangs off.
    {
        id: "blackGroups",
        highlight: [61, 63, 66, 68, 70],
        play: [{ kind: "anyBlack" }],
    },
    // The one landmark. Named relative to the group of two, so it can be found by
    // looking rather than by counting from the end of the keyboard.
    {
        id: "middleC",
        highlight: [MIDDLE_C],
        play: [{ kind: "note", note: MIDDLE_C }],
    },
    // The white keys are seven names that start over. Walking them is how that stops
    // being a sentence and becomes something the hand knows.
    {
        id: "whiteRun",
        highlight: WHITE_OCTAVE,
        play: WHITE_OCTAVE.map((note) => ({ kind: "note", note }) as const),
    },
    // A black key is the one in between, and it has two names depending on which
    // neighbour you came from — the fact that makes sharps and flats stop being two
    // different things.
    {
        id: "blackNames",
        highlight: [61],
        play: [{ kind: "note", note: 61 }],
    },
    // The leap that beginners find hardest: a dot printed on a staff is a key under
    // your hand. Nothing about the tour matters more than this one.
    {
        id: "noteToKey",
        highlight: [64],
        play: [{ kind: "note", note: 64 }],
        staff: [64],
    },
    // Why the staff is drawn the way it is: up the page is up in pitch, which is to the
    // right under your hand.
    {
        id: "highLow",
        highlight: [MIDDLE_C, MIDDLE_C + 12],
        play: [
            { kind: "note", note: MIDDLE_C },
            { kind: "note", note: MIDDLE_C + 12 },
        ],
        staff: [MIDDLE_C, MIDDLE_C + 12],
    },
];

export type TourState = {
    // Index into TOUR_STEPS, or TOUR_STEPS.length once the tour is finished.
    step: number;
    // How many of the current step's targets have been played.
    matched: number;
};

export function beginTour(): TourState {
    return { step: 0, matched: 0 };
}

export function currentStep(state: TourState): TourStep | null {
    return TOUR_STEPS[state.step] ?? null;
}

export function isDone(state: TourState): boolean {
    return state.step >= TOUR_STEPS.length;
}

function satisfies(target: TourTarget, note: number): boolean {
    return target.kind === "anyBlack" ? isBlackKey(note) : target.note === note;
}

// Fold a played note into the tour. Only the note the step is waiting for moves it on;
// anything else leaves the state exactly as it was, so a wandering hand costs nothing.
export function observe(state: TourState, note: number): TourState {
    const step = currentStep(state);
    if (!step) {
        return state;
    }
    const target = step.play[state.matched];
    if (!target || !satisfies(target, note)) {
        return state;
    }
    return { ...state, matched: state.matched + 1 };
}

// Whether the current step has been played through and the tour can move on.
export function stepReady(state: TourState): boolean {
    const step = currentStep(state);
    return step !== null && state.matched >= step.play.length;
}

export function nextStep(state: TourState): TourState {
    return isDone(state) ? state : { step: state.step + 1, matched: 0 };
}

// How far through the whole tour, 0..1 — for a progress bar that counts steps rather
// than presses, so a long step doesn't look like six short ones.
export function tourProgress(state: TourState): number {
    return Math.min(1, state.step / TOUR_STEPS.length);
}

// The keys still waiting to be played in this step, so the keyboard can prompt the next
// one without giving away the whole sequence at once.
export function awaited(state: TourState): number[] {
    const step = currentStep(state);
    const target = step?.play[state.matched];
    if (!target) {
        return [];
    }
    return target.kind === "note" ? [target.note] : [];
}
