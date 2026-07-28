// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generated reading drills: fresh notation on demand, shaped by the reader rather
// than fixed by the code. The old generator drew one note per beat from a
// five-finger box in one of four keys — enough for a first week and nothing
// after it. This draws from any key, any span of the keyboard, in chords or
// single notes, so a drill can meet a reader wherever they actually are.
//
// Pure: the rng arrives as a parameter, so a seeded drill (the daily) and an
// unseeded one (a warm-up) run the identical code.

import {
    alterFor,
    type BuiltNote,
    type BuiltPitch,
    buildScore,
    RHYTHM,
    type RhythmValue,
} from "./musicxmlBuild";

// Which rhythms a drill draws from. "quarters" is one note per beat, the simplest
// read; "eighths" runs steady eighths for flow; "varied" mixes halves, quarters and
// on-beat eighth pairs so the timing has something to read against. None of them
// syncopate, dot or tie — a generated phrase should test reading, not puzzle-solving.
export const DRILL_RHYTHMS = ["quarters", "eighths", "varied"] as const;
export type DrillRhythm = (typeof DRILL_RHYTHMS)[number];

// The circle of fifths, sharps positive. 15 signatures: 7 flats through 7 sharps.
export const MIN_FIFTHS = -7;
export const MAX_FIFTHS = 7;

// The playable span a drill may draw from, and the widest a picker should offer:
// the 88-key keyboard, A0 to C8.
export const LOWEST_MIDI = 21;
export const HIGHEST_MIDI = 108;

export type DrillOptions = {
    bars: number;
    beatsPerBar: number;
    // 1 draws a single treble line; 2 splits the range into a grand staff.
    hands: 1 | 2;
    // Key signature as a position on the circle of fifths. Ignored when chromatic.
    fifths: number;
    // Draw from all twelve pitch classes rather than one key's seven. The score is
    // still written in `fifths` so the reader has a signature to read against.
    chromatic: boolean;
    // Inclusive MIDI bounds of the pitches drawn.
    low: number;
    high: number;
    // Notes struck together: 1 is a melody, more builds chords to read vertically.
    notesPerColumn: number;
    // The widest jump allowed between consecutive columns, in semitones. 0 lifts
    // the limit — the drill may leap anywhere in range.
    maxLeap: number;
    rhythm: DrillRhythm;
    // How hard the drill works to keep consecutive columns close: each step is
    // another candidate column, keeping whichever moves least. 0 picks freely.
    smoothness: number;
    title?: string;
};

export const DEFAULT_DRILL: DrillOptions = {
    bars: 8,
    beatsPerBar: 4,
    hands: 1,
    fifths: 0,
    chromatic: false,
    low: 60,
    high: 72,
    notesPerColumn: 1,
    maxLeap: 0,
    rhythm: "quarters",
    smoothness: 0,
};

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
// Semitones above C for each natural letter.
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// A MIDI note spelled for a key signature: the letter whose signature alteration
// already lands on this pitch when there is one, so a scale tone is written plain
// and the signature does the work. A note outside the key takes an accidental,
// leaning the way the key does — sharps in sharp keys, flats in flat keys.
export function spell(midi: number, fifths: number): BuiltPitch {
    const pc = ((midi % 12) + 12) % 12;
    for (const letter of LETTERS) {
        const alter = alterFor(letter, fifths);
        if (((((NATURAL[letter] ?? 0) + alter) % 12) + 12) % 12 === pc) {
            return { step: letter, octave: octaveOf(midi, letter, alter), alter };
        }
    }
    // Not in the key: borrow the neighbouring letter and raise or lower it.
    const direction = fifths < 0 ? 1 : -1;
    for (const letter of LETTERS) {
        const base = alterFor(letter, fifths);
        const alter = base - direction;
        if (Math.abs(alter) <= 2 && ((((NATURAL[letter] ?? 0) + alter) % 12) + 12) % 12 === pc) {
            return { step: letter, octave: octaveOf(midi, letter, alter), alter };
        }
    }
    // Every pitch class is reachable above; this keeps the return total.
    return { step: "C", octave: Math.floor(midi / 12) - 1, alter: 0 };
}

// MIDI numbers name C-1 as 0, so the octave is the note's own C. A B# or Cb
// belongs to the octave of its letter, not of its sounding pitch, which is why the
// alteration comes back out here.
function octaveOf(midi: number, letter: string, alter: number): number {
    const natural = midi - alter;
    return Math.floor(natural / 12) - 1 + (natural % 12 < (NATURAL[letter] ?? 0) ? 1 : 0);
}

// Every MIDI note in range the drill may draw, low to high: the key's seven pitch
// classes, or all twelve when chromatic. Empty when the range is inverted or holds
// no note of the key.
export function pitchPool(options: DrillOptions): number[] {
    const { low, high, fifths, chromatic } = options;
    const inKey = new Set(
        LETTERS.map((letter) => (((NATURAL[letter] ?? 0) + alterFor(letter, fifths)) % 12 + 12) % 12),
    );
    const pool: number[] = [];
    for (let midi = Math.max(LOWEST_MIDI, low); midi <= Math.min(HIGHEST_MIDI, high); midi++) {
        if (chromatic || inKey.has(((midi % 12) + 12) % 12)) {
            pool.push(midi);
        }
    }
    return pool;
}

// The rhythm of one bar, as note values summing to exactly a barful.
function barRhythm(
    rhythm: DrillRhythm,
    beatsPerBar: number,
    rng: () => number,
): RhythmValue[] {
    const target = beatsPerBar * RHYTHM.quarter.divisions;
    if (rhythm === "quarters") {
        return Array.from({ length: beatsPerBar }, () => "quarter" as const);
    }
    if (rhythm === "eighths") {
        return Array.from({ length: beatsPerBar * 2 }, () => "eighth" as const);
    }
    const values: RhythmValue[] = [];
    let filled = 0;
    while (filled < target) {
        const roll = rng();
        const left = target - filled;
        if (left >= RHYTHM.half.divisions && roll < 0.15) {
            values.push("half");
            filled += RHYTHM.half.divisions;
        } else if (left >= RHYTHM.quarter.divisions && roll < 0.4) {
            values.push("eighth", "eighth");
            filled += RHYTHM.quarter.divisions;
        } else {
            values.push("quarter");
            filled += RHYTHM.quarter.divisions;
        }
    }
    return values;
}

// One column of pitches drawn from the pool: a single note, or several stacked into
// a chord. Chord tones are spread rather than adjacent so the shape reads as a chord
// on the staff instead of a cluster.
function drawColumn(pool: number[], count: number, rng: () => number): number[] {
    const first = pool[Math.floor(rng() * pool.length)] ?? pool[0] ?? 60;
    const column = [first];
    for (let n = 1; n < count; n++) {
        const above = pool.filter((midi) => midi > (column[column.length - 1] ?? 0) + 2);
        if (above.length === 0) {
            break;
        }
        // Keep the stack tight: draw from the nearest few playable tones above.
        const reach = above.slice(0, Math.min(3, above.length));
        column.push(reach[Math.floor(rng() * reach.length)] ?? reach[0] ?? first);
    }
    return column;
}

// How far a column sits from the one before it, measured at its lowest note — the
// hand's anchor, and what a leap limit is really about.
function distance(previous: number[] | null, column: number[]): number {
    if (!previous) {
        return 0;
    }
    return Math.abs((column[0] ?? 0) - (previous[0] ?? 0));
}

// The next column: drawn, then re-drawn `smoothness` times keeping whichever moves
// least, and re-drawn again while it breaks the leap limit. Both are best-effort —
// a narrow range may make a limit unsatisfiable, and a drill that cannot be
// generated is worse than one that leaps once.
function nextColumn(
    pool: number[],
    options: DrillOptions,
    previous: number[] | null,
    rng: () => number,
): number[] {
    const { notesPerColumn, smoothness, maxLeap } = options;
    let best = drawColumn(pool, notesPerColumn, rng);
    for (let attempt = 0; attempt < smoothness; attempt++) {
        const candidate = drawColumn(pool, notesPerColumn, rng);
        if (distance(previous, candidate) < distance(previous, best)) {
            best = candidate;
        }
    }
    if (maxLeap > 0 && distance(previous, best) > maxLeap) {
        const near = pool.filter(
            (midi) => Math.abs(midi - (previous?.[0] ?? midi)) <= maxLeap,
        );
        if (near.length > 0) {
            best = drawColumn(near, notesPerColumn, rng);
        }
    }
    return best;
}

// A line of notes for one hand, drawn from its own slice of the range.
function line(pool: number[], options: DrillOptions, rng: () => number): BuiltNote[] {
    if (pool.length === 0) {
        return [];
    }
    const notes: BuiltNote[] = [];
    let previous: number[] | null = null;
    for (let bar = 0; bar < options.bars; bar++) {
        for (const value of barRhythm(options.rhythm, options.beatsPerBar, rng)) {
            const column = nextColumn(pool, options, previous, rng);
            previous = column;
            const [head, ...rest] = column;
            notes.push({
                pitch: spell(head ?? 60, options.fifths),
                value,
                ...(rest.length > 0
                    ? { with: rest.map((midi) => spell(midi, options.fifths)) }
                    : {}),
            });
        }
    }
    return notes;
}

// The drill as MusicXML. Two hands split the range at its midpoint, so each hand
// reads its own half rather than both drawing from the whole span and crossing.
export function generateDrill(options: DrillOptions, rng: () => number): string {
    const low = Math.min(options.low, options.high);
    const high = Math.max(options.low, options.high);
    const bounded = { ...options, low, high };
    // Chromatic drills still carry a signature: the reader needs something to read
    // the accidentals against, and "no key" is not a thing a staff can show.
    const fifths = options.fifths;

    if (bounded.hands === 2) {
        const middle = Math.floor((low + high) / 2);
        const treblePool = pitchPool({ ...bounded, low: middle });
        const bassPool = pitchPool({ ...bounded, high: middle - 1 });
        return buildScore({
            title: options.title ?? "Drill",
            fifths,
            beatsPerBar: options.beatsPerBar,
            treble: line(treblePool.length > 0 ? treblePool : pitchPool(bounded), bounded, rng),
            bass: line(bassPool.length > 0 ? bassPool : pitchPool(bounded), bounded, rng),
        });
    }
    return buildScore({
        title: options.title ?? "Drill",
        fifths,
        beatsPerBar: options.beatsPerBar,
        treble: line(pitchPool(bounded), bounded, rng),
    });
}
