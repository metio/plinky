// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A short course in the theory a reader needs to make sense of the page in front of
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
    | { kind: "compare"; first: number[]; second: number[] };

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

    // Keys: why a piece carries sharps or flats, and what a scale is.
    { id: "major", unit: "keys", demo: { kind: "scale", tonic: C, scale: "major" } },
    { id: "minor", unit: "keys", demo: { kind: "scale", tonic: C + 9, scale: "natural-minor" } },
    { id: "signature", unit: "keys", demo: { kind: "circle", tonic: 7 } },

    // Harmony: stacking those notes up.
    { id: "triads", unit: "harmony", demo: { kind: "chord", root: C, quality: "major" } },
    {
        id: "colour",
        unit: "harmony",
        demo: { kind: "compare", first: [C, C + 4, C + 7], second: [C, C + 3, C + 7] },
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
