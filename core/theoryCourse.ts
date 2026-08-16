// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A short course in the theory a reader needs to make sense of the page in front of
import type { SnippetNote } from "./glossaryScore";
import type { ChordQuality, ScaleId } from "./theory";
// them, in the order that need arises.
//
// The glossary answers "what is this mark?" for someone already looking at one, and
// the keyboard tour answers "where are the notes?". Neither answers "why is this piece
// in three sharps" or "what makes that chord sound sad", which is the ground under
// both. This is that ground, and it is deliberately short: eight lessons a beginner
// can finish, not a syllabus they will abandon.
//
// Ids only, no words — the lesson text lives in the message catalogue like the theory
// exercise names do, so translating the course translates nothing here. Each lesson
// names the demonstration it carries, and the route maps that to a component; a lesson
// is therefore a thing you do, not a thing you read.

export type UnitId = "reading" | "keys" | "harmony";

// What the lesson puts under its text. Every one is built from an engine Plinky
// already runs — the keybed, the synth, the engraver, the circle — so a lesson costs
// a paragraph and a wiring line rather than a new feature.
export type Demo =
    | { kind: "keyboard"; notes: number[] }
    // A scale or chord lit on the keys and playable, named by its theory id.
    | { kind: "scale"; tonic: number; scale: ScaleId }
    | { kind: "chord"; root: number; quality: ChordQuality }
    // The circle of fifths, focused on one key.
    | { kind: "circle"; tonic: number }
    // Two chords played one after the other, so the difference is audible rather than
    // described — the only way a lesson about how something sounds can be honest.
    | { kind: "compare"; first: number[]; second: number[] }
    // Chords in turn, for the lessons about what one chord does after another.
    | { kind: "progression"; chords: number[][] }
    // A written example is itself the demonstration: length, silence and the left hand's
    // clef are facts about the page, and no arrangement of lit keys can show them.
    // `play` is what the example sounds when pressed.
    | {
          kind: "stave";
          clef: "treble" | "bass";
          fifths: number;
          notes: SnippetNote[];
          play: number[];
      };

export type Lesson = {
    id: string;
    unit: UnitId;
    demo: Demo;
};

// Middle C, the register every demonstration sits in.
const C = 60;

export const UNITS: UnitId[] = ["reading", "keys", "harmony"];

export const LESSONS: Lesson[] = [
    // Reading: the two things a stave encodes — which note, and for how long.
    { id: "staff", unit: "reading", demo: { kind: "keyboard", notes: [C, C + 4, C + 7] } },
    { id: "steps", unit: "reading", demo: { kind: "compare", first: [C], second: [C + 1] } },
    { id: "octave", unit: "reading", demo: { kind: "compare", first: [C], second: [C + 12] } },
    {
        id: "values",
        unit: "reading",
        demo: {
            kind: "stave",
            clef: "treble",
            fifths: 0,
            notes: [
                { step: "C", octave: 4, value: "whole" },
                { step: "C", octave: 4, value: "half" },
                { step: "C", octave: 4, value: "half" },
                ...Array.from({ length: 4 }, () => ({
                    step: "C",
                    octave: 4,
                    value: "quarter" as const,
                })),
            ],
            play: [C, C, C, C, C, C, C],
        },
    },
    {
        id: "rests",
        unit: "reading",
        demo: {
            kind: "stave",
            clef: "treble",
            fifths: 0,
            notes: [
                { step: "G", octave: 4, value: "quarter" },
                { step: null, value: "quarter" },
                { step: "E", octave: 4, value: "quarter" },
                { step: null, value: "quarter" },
            ],
            play: [C + 7, C + 4],
        },
    },
    {
        id: "bass",
        unit: "reading",
        demo: {
            kind: "stave",
            clef: "bass",
            fifths: 0,
            notes: [
                { step: "C", octave: 3, value: "half" },
                { step: "G", octave: 2, value: "half" },
                { step: "C", octave: 2, value: "whole" },
            ],
            play: [C - 12, C - 17, C - 24],
        },
    },

    // Keys: why a piece carries sharps or flats, and what a scale is.
    { id: "major", unit: "keys", demo: { kind: "scale", tonic: C, scale: "major" } },
    { id: "minor", unit: "keys", demo: { kind: "scale", tonic: C + 9, scale: "natural-minor" } },
    { id: "signature", unit: "keys", demo: { kind: "circle", tonic: 7 } },
    {
        id: "relative",
        unit: "keys",
        demo: { kind: "compare", first: [C, C + 4, C + 7], second: [C - 3, C, C + 4] },
    },

    // Harmony: stacking those notes up.
    { id: "triads", unit: "harmony", demo: { kind: "chord", root: C, quality: "major" } },
    {
        id: "colour",
        unit: "harmony",
        demo: { kind: "compare", first: [C, C + 4, C + 7], second: [C, C + 3, C + 7] },
    },
    {
        id: "family",
        unit: "harmony",
        demo: {
            kind: "progression",
            chords: [
                [C, C + 4, C + 7],
                [C + 5, C + 9, C + 12],
                [C + 7, C + 11, C + 14],
            ],
        },
    },
    {
        id: "cadence",
        unit: "harmony",
        demo: {
            kind: "progression",
            chords: [
                [C + 7, C + 11, C + 14],
                [C, C + 4, C + 7],
            ],
        },
    },
];

export function lessonsIn(unit: UnitId): Lesson[] {
    return LESSONS.filter((lesson) => lesson.unit === unit);
}

export function lessonById(id: string): Lesson | null {
    return LESSONS.find((lesson) => lesson.id === id) ?? null;
}

// How far through the course a set of finished lesson ids has got, 0..1. The course
// keeps no schedule and nothing expires: it is a thing to finish once, so the only
// question it asks is how much is left.
export function courseProgress(done: Iterable<string>): number {
    const known = new Set(LESSONS.map((lesson) => lesson.id));
    const finished = new Set([...done].filter((id) => known.has(id)));
    return LESSONS.length === 0 ? 0 : finished.size / LESSONS.length;
}
