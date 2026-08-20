// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Rhythms to read and tap, as a graded ladder.
//
// Rhythm is already graded everywhere else in Plinky, but only ever as a by-product of
// playing pitches: you read a piece, and how well you kept time falls out of how well you
// played it. That leaves the reader who can hold a pulse but cannot yet *read* one with
// nowhere to work — and it hides which of the two a wobbly run was. Here there are no
// pitches at all. One line, one sound, and the only question is when.
//
// A bar is built from whole beats rather than from loose durations, which is how a
// rhythm is actually read: the eye takes a beat at a time and recognises its shape. It
// also means a generated bar cannot come out over- or under-full, so nothing downstream
// has to cope with a bar that does not add up.

export type NoteValueId =
    | "whole"
    | "dotted-half"
    | "half"
    | "dotted-quarter"
    | "quarter"
    | "dotted-eighth"
    | "eighth"
    | "sixteenth"
    | "triplet-eighth";

// One notated event. `beats` is its written length in beats of the bar's beat unit;
// a rest occupies the time without asking for a tap.
export type Cell = {
    value: NoteValueId;
    beats: number;
    rest: boolean;
    // Which beam group this belongs to, for the ones that beam together. Cells sharing a
    // group are drawn under one beam; undefined stands alone with a flag.
    group?: number;
};

export type RhythmPattern = {
    level: number;
    beatsPerBar: number;
    // The note value that gets one beat: 4 for the simple times, 8 for the compound ones.
    beatUnit: 4 | 8;
    bars: number;
    cells: Cell[];
};

// A figure filling a whole number of beats. Generation picks whole figures, never
// individual durations, so a bar always adds up.
type Figure = { beats: number; cells: Omit<Cell, "group">[]; beamed?: boolean };

const note = (value: NoteValueId, beats: number): Omit<Cell, "group"> => ({
    value,
    beats,
    rest: false,
});
const rest = (value: NoteValueId, beats: number): Omit<Cell, "group"> => ({
    value,
    beats,
    rest: true,
});

const QUARTER: Figure = { beats: 1, cells: [note("quarter", 1)] };
const QUARTER_REST: Figure = { beats: 1, cells: [rest("quarter", 1)] };
const HALF: Figure = { beats: 2, cells: [note("half", 2)] };
const HALF_REST: Figure = { beats: 2, cells: [rest("half", 2)] };
const DOTTED_HALF: Figure = { beats: 3, cells: [note("dotted-half", 3)] };
const WHOLE: Figure = { beats: 4, cells: [note("whole", 4)] };
const TWO_EIGHTHS: Figure = {
    beats: 1,
    cells: [note("eighth", 0.5), note("eighth", 0.5)],
    beamed: true,
};
const EIGHTH_REST_EIGHTH: Figure = {
    beats: 1,
    cells: [rest("eighth", 0.5), note("eighth", 0.5)],
};
const EIGHTH_EIGHTH_REST: Figure = {
    beats: 1,
    cells: [note("eighth", 0.5), rest("eighth", 0.5)],
};
// A dotted quarter needs the eighth after it to complete the pair of beats, so the two
// travel together as one two-beat figure — the figure that makes a rhythm swing.
const DOTTED_QUARTER_EIGHTH: Figure = {
    beats: 2,
    cells: [note("dotted-quarter", 1.5), note("eighth", 0.5)],
};
const FOUR_SIXTEENTHS: Figure = {
    beats: 1,
    cells: [
        note("sixteenth", 0.25),
        note("sixteenth", 0.25),
        note("sixteenth", 0.25),
        note("sixteenth", 0.25),
    ],
    beamed: true,
};
const EIGHTH_TWO_SIXTEENTHS: Figure = {
    beats: 1,
    cells: [note("eighth", 0.5), note("sixteenth", 0.25), note("sixteenth", 0.25)],
    beamed: true,
};
const TWO_SIXTEENTHS_EIGHTH: Figure = {
    beats: 1,
    cells: [note("sixteenth", 0.25), note("sixteenth", 0.25), note("eighth", 0.5)],
    beamed: true,
};
const DOTTED_EIGHTH_SIXTEENTH: Figure = {
    beats: 1,
    cells: [note("dotted-eighth", 0.75), note("sixteenth", 0.25)],
    beamed: true,
};
const TRIPLET: Figure = {
    beats: 1,
    cells: [
        note("triplet-eighth", 1 / 3),
        note("triplet-eighth", 1 / 3),
        note("triplet-eighth", 1 / 3),
    ],
    beamed: true,
};
// Compound time counts in dotted quarters, so one beat of 6/8 is three eighths.
const COMPOUND_THREE: Figure = {
    beats: 1,
    cells: [note("eighth", 1 / 3), note("eighth", 1 / 3), note("eighth", 1 / 3)],
    beamed: true,
};
const COMPOUND_LONG_SHORT: Figure = {
    beats: 1,
    cells: [note("quarter", 2 / 3), note("eighth", 1 / 3)],
};
const COMPOUND_DOTTED: Figure = { beats: 1, cells: [note("dotted-quarter", 1)] };

export type RhythmLevel = {
    beatsPerBar: number;
    beatUnit: 4 | 8;
    bars: number;
    figures: Figure[];
};

// Twelve steps, each adding exactly one idea to the one before it. The ladder is
// numbered rather than named: what a level contains is the notation on the page, and a
// name for it would be a word to learn before the thing it names.
export const RHYTHM_LEVELS: RhythmLevel[] = [
    // Just the beat.
    { beatsPerBar: 4, beatUnit: 4, bars: 2, figures: [QUARTER] },
    // Silence is a rhythm too — and the first thing that catches a player who taps along
    // to the pulse rather than reading it.
    { beatsPerBar: 4, beatUnit: 4, bars: 2, figures: [QUARTER, QUARTER_REST] },
    // Notes longer than a beat: the tap comes once and the counting carries on.
    { beatsPerBar: 4, beatUnit: 4, bars: 2, figures: [QUARTER, HALF, HALF_REST] },
    { beatsPerBar: 4, beatUnit: 4, bars: 2, figures: [QUARTER, HALF, WHOLE, QUARTER_REST] },
    // Dividing the beat.
    { beatsPerBar: 4, beatUnit: 4, bars: 2, figures: [QUARTER, TWO_EIGHTHS] },
    {
        beatsPerBar: 4,
        beatUnit: 4,
        bars: 2,
        figures: [QUARTER, TWO_EIGHTHS, EIGHTH_REST_EIGHTH, EIGHTH_EIGHTH_REST],
    },
    // Three beats to the bar: the same figures, a different pulse to hold.
    { beatsPerBar: 3, beatUnit: 4, bars: 2, figures: [QUARTER, TWO_EIGHTHS, DOTTED_HALF] },
    // The long-short figure, and the first rhythm that leans off the beat.
    {
        beatsPerBar: 4,
        beatUnit: 4,
        bars: 2,
        figures: [QUARTER, TWO_EIGHTHS, DOTTED_QUARTER_EIGHTH],
    },
    // Dividing the beat again.
    { beatsPerBar: 4, beatUnit: 4, bars: 2, figures: [QUARTER, TWO_EIGHTHS, FOUR_SIXTEENTHS] },
    {
        beatsPerBar: 4,
        beatUnit: 4,
        bars: 2,
        figures: [QUARTER, FOUR_SIXTEENTHS, EIGHTH_TWO_SIXTEENTHS, TWO_SIXTEENTHS_EIGHTH],
    },
    // The dotted pair, which is the sixteenth figure everybody meets in real music.
    {
        beatsPerBar: 4,
        beatUnit: 4,
        bars: 2,
        figures: [QUARTER, TWO_EIGHTHS, DOTTED_EIGHTH_SIXTEENTH, FOUR_SIXTEENTHS],
    },
    // Three in the time of two.
    { beatsPerBar: 4, beatUnit: 4, bars: 2, figures: [QUARTER, TWO_EIGHTHS, TRIPLET] },
    // Compound time, counted in dotted beats rather than in eighths.
    {
        beatsPerBar: 2,
        beatUnit: 8,
        bars: 2,
        figures: [COMPOUND_THREE, COMPOUND_LONG_SHORT, COMPOUND_DOTTED],
    },
];

const pick = <T>(items: readonly T[], rng: () => number): T =>
    items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;

// Fills one bar with whole figures. A figure too long for the room left is not offered,
// so the bar cannot overflow; when nothing fits, the remainder is a rest, which only
// happens if a level offers no one-beat figure at all.
function fillBar(level: RhythmLevel, rng: () => number, group: { next: number }): Cell[] {
    const cells: Cell[] = [];
    let left = level.beatsPerBar;
    while (left > 0) {
        const options = level.figures.filter((figure) => figure.beats <= left);
        const figure = options.length > 0 ? pick(options, rng) : null;
        if (!figure) {
            cells.push({ value: "quarter", beats: left, rest: true });
            break;
        }
        const beam = figure.beamed ? group.next++ : undefined;
        for (const cell of figure.cells) {
            cells.push(beam === undefined ? { ...cell } : { ...cell, group: beam });
        }
        left -= figure.beats;
    }
    return cells;
}

export function generateRhythm(levelIndex: number, rng: () => number): RhythmPattern {
    const index = Math.min(Math.max(0, Math.floor(levelIndex)), RHYTHM_LEVELS.length - 1);
    const level = RHYTHM_LEVELS[index] as RhythmLevel;
    const group = { next: 0 };
    const cells: Cell[] = [];
    for (let bar = 0; bar < level.bars; bar++) {
        cells.push(...fillBar(level, rng, group));
    }
    return {
        level: index,
        beatsPerBar: level.beatsPerBar,
        beatUnit: level.beatUnit,
        bars: level.bars,
        cells,
    };
}

// Where each cell begins, in beats from the start of the first bar.
export function cellBeats(pattern: RhythmPattern): number[] {
    const starts: number[] = [];
    let at = 0;
    for (const cell of pattern.cells) {
        starts.push(at);
        at += cell.beats;
    }
    return starts;
}

// The moments a tap is expected, in milliseconds from the start of the pattern. Rests
// ask for nothing, so they are absent — which is what makes a rest gradeable at all.
export function expectedOnsets(pattern: RhythmPattern, bpm: number): number[] {
    const msPerBeat = 60_000 / Math.max(1, bpm);
    const starts = cellBeats(pattern);
    const onsets: number[] = [];
    pattern.cells.forEach((cell, index) => {
        if (!cell.rest) {
            onsets.push((starts[index] as number) * msPerBeat);
        }
    });
    return onsets;
}

// How long the whole pattern lasts, so the surface knows when to stop listening.
export function patternMs(pattern: RhythmPattern, bpm: number): number {
    return pattern.bars * pattern.beatsPerBar * (60_000 / Math.max(1, bpm));
}
