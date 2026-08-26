// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A short course in the theory a reader needs to make sense of the page in front of
// them, in the order that need arises.
//
// The glossary answers "what is this mark?" for someone already looking at one, and
// the keyboard tour answers "where are the notes?". Neither answers "why is this piece
// in three sharps" or "what makes that chord sound sad", which is the ground under
// both. This is that ground, and it is deliberately short: a course a beginner can
// finish, not a syllabus they will abandon.
//
// Ids only, no words — the lesson text lives in the message catalogue like the theory
// exercise names do, so translating the course translates nothing here. Each lesson
// names the demonstration it carries, and the route maps that to a component; a lesson
// is therefore a thing you do, not a thing you read.
//
// Every lesson carries one timeline (core/theoryDemo.ts) rather than a kind the page
// switches on. That collapsed seven shapes into one and fixed a class of bug with it:
// the drawing, the sound and the lit keys are now three readings of the same steps, so
// a lesson cannot draw one thing and play another.

import { chordPitches, type ScaleId, scalePitches } from "./theory";
import type { DemoScore, DemoStep } from "./theoryDemo";

export type UnitId = "reading" | "keys" | "harmony";

// What the lesson puts under its text. Every one is built from an engine Plinky
// already runs — the keybed, the synth, the engraver, the circle — so a lesson costs
// a paragraph and a wiring line rather than a new feature.
// What the lesson puts under its text: notes in time, on a stave, over a keyboard wide
// enough to hold them. Built from engines Plinky already runs — the engraver, the synth,
// the keybed — so a lesson costs a paragraph and a few steps rather than a new feature.
export type Demo = DemoScore & {
    // The keys the reader needs under the lesson. Not always the octave above middle C:
    // the lesson about the bass clef is about notes below it, and drew a keyboard with
    // none of them on it.
    from: number;
    to: number;
    // The circle of fifths, focused on one key — the signature lesson's own picture, which
    // no arrangement of notes can stand in for.
    circle?: number;
};

export type Lesson = {
    id: string;
    unit: UnitId;
    demo: Demo;
};

// Middle C, the register every demonstration sits in unless the lesson is about another.
const C = 60;
// The octave above middle C: where a beginner sits, and the keyboard a lesson gets unless
// it asks for more.
const HOME = { from: 60, to: 84 } as const;
const TREBLE = { clef: "treble", fifths: 0, ...HOME } as const;

// A run of single notes, one per step.
const line = (notes: number[], value: DemoStep["value"] = "quarter"): DemoStep[] =>
    notes.map((note) => ({ notes: [note], value }));

// Notes sounding together: one step, several pitches.
const together = (notes: number[], value: DemoStep["value"] = "half"): DemoStep => ({
    notes,
    value,
});

const silence = (value: DemoStep["value"] = "quarter"): DemoStep => ({ notes: [], value });

// A scale, up and stopping on the tonic above. scalePitches already ends on the octave,
// so this is eight quarter notes — the shape of the thing, and two bars exactly.
const scaleSteps = (tonic: number, scale: ScaleId): DemoStep[] => line(scalePitches(tonic, scale));

export const UNITS: UnitId[] = ["reading", "keys", "harmony"];

export const LESSONS: Lesson[] = [
    // Reading: the two things a stave encodes — which note, and for how long.
    {
        id: "staff",
        unit: "reading",
        // Four notes climbing, one after another. The lesson is about a dot's height saying
        // which key, so they have to be heard apart to be heard at all — and reaching the
        // octave puts the highest of them a clear distance above the lowest.
        demo: { ...TREBLE, steps: line([C, C + 4, C + 7, C + 12], "half") },
    },
    {
        id: "steps",
        unit: "reading",
        // A semitone: the note, then the black key beside it. Both are drawn, the sharp
        // written out, because the black key is the entire lesson.
        demo: { ...TREBLE, steps: line([C, C + 1], "half") },
    },
    {
        id: "octave",
        unit: "reading",
        demo: { ...TREBLE, steps: line([C, C + 12], "half") },
    },
    {
        id: "values",
        unit: "reading",
        // One pitch at four lengths, so the only thing that changes is the thing the
        // lesson is about. Played as one sound each, which is what makes a whole note
        // audibly whole.
        demo: {
            ...TREBLE,
            steps: [
                { notes: [C], value: "whole" },
                { notes: [C], value: "half" },
                { notes: [C], value: "half" },
                ...line([C, C, C, C]),
            ],
        },
    },
    {
        id: "rests",
        unit: "reading",
        // The silences are steps like the notes are. They take their time without
        // sounding, which is the whole of what a rest is and cannot be shown any other way.
        demo: {
            ...TREBLE,
            steps: [
                { notes: [C + 7], value: "quarter" },
                silence(),
                { notes: [C + 4], value: "quarter" },
                silence(),
            ],
        },
    },
    {
        id: "bass",
        unit: "reading",
        // Below middle C, on the clef that draws it — and over a keyboard that reaches
        // down to it, which the shared one did not.
        demo: {
            clef: "bass",
            fifths: 0,
            from: 36,
            to: 60,
            steps: [
                { notes: [C - 12], value: "half" },
                { notes: [C - 17], value: "half" },
                { notes: [C - 24], value: "whole" },
            ],
        },
    },

    // Keys: why a piece carries sharps or flats, and what a scale is.
    { id: "major", unit: "keys", demo: { ...TREBLE, steps: scaleSteps(C, "major") } },
    {
        id: "minor",
        unit: "keys",
        // A minor, which needs the A below middle C to start on and the octave above it.
        demo: {
            clef: "treble",
            fifths: 0,
            from: 57,
            to: 81,
            steps: scaleSteps(C - 3, "natural-minor"),
        },
    },
    {
        id: "signature",
        unit: "keys",
        // G major, whose signature is the one sharp the lesson is about — heard as the
        // scale that needs it, beside the circle that explains why.
        demo: { ...TREBLE, circle: 7, steps: scaleSteps(C + 7, "major") },
    },
    {
        id: "relative",
        unit: "keys",
        // C major and A minor: the same notes, a different home. Two chords in turn.
        demo: {
            ...TREBLE,
            from: 57,
            steps: [together(chordPitches(C, "major")), together(chordPitches(C - 3, "minor"))],
        },
    },

    // Harmony: stacking those notes up.
    {
        id: "triads",
        unit: "harmony",
        demo: { ...TREBLE, steps: [together(chordPitches(C, "major"), "whole")] },
    },
    {
        id: "colour",
        unit: "harmony",
        // Major then minor on the same root: one note moves, and that is the lesson.
        demo: {
            ...TREBLE,
            steps: [together(chordPitches(C, "major")), together(chordPitches(C, "minor"))],
        },
    },
    {
        id: "family",
        unit: "harmony",
        demo: {
            ...TREBLE,
            // A bar each, so three chords are heard as three rather than as a phrase.
            steps: [
                together(chordPitches(C, "major"), "whole"),
                together(chordPitches(C + 5, "major"), "whole"),
                together(chordPitches(C + 7, "major"), "whole"),
            ],
        },
    },
    {
        id: "cadence",
        unit: "harmony",
        demo: {
            ...TREBLE,
            // The leaning chord and the one it lands on, a bar each.
            steps: [
                together(chordPitches(C + 7, "major"), "whole"),
                together(chordPitches(C, "major"), "whole"),
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
