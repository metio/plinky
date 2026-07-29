// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The notation glossary: the marks a beginner meets in a score, each with a bar of
// music that shows it and a way to hear what it does.
//
// Notation is instructions for sound, so an entry that only names a symbol has left
// out the half that matters. Where a mark changes what you hear, the entry carries a
// second version of the phrase with the mark taken away — the same music, plainly
// played — and the pair is the explanation. Where a mark instructs the hands rather
// than the sound (a slur, a clef), there is only the one reading, and the gloss says
// what to do with it.
//
// The sounding rules are not re-decided here: performNote is the same function Listen
// plays a real score through, so a staccato demonstrated here is clipped by exactly
// the rule that clips it in a piece.

import { performNote } from "./expression";
import { noteQuarters, type Snippet, snippetMidi } from "./glossaryScore";

// What a symbol controls. Grouping by this rather than by difficulty tells a reader
// something true before they have read a single entry: which of the four questions
// about a note this mark is answering.
export type GlossaryCategory = "length" | "touch" | "loudness" | "place";

export const CATEGORIES: GlossaryCategory[] = ["length", "touch", "loudness", "place"];

export type GlossaryEntry = {
    id: string;
    category: GlossaryCategory;
    // The bar that gets drawn, and what "Hear it" plays.
    shown: Snippet;
    // The same music without the mark, for the comparison — or null when the mark
    // changes nothing you could hear, in which case there is nothing to compare and
    // the entry offers a single reading.
    plain: Snippet | null;
};

// The loudness p and f stand for in the demonstration. A real score's dynamic comes
// from the piece itself; these are the two ends a beginner needs to tell apart.
const DYNAMIC_VELOCITY: Record<"p" | "f", number> = { p: 45, f: 112 };

// Unhurried, so a clipped note and a held one are easy to tell apart by ear.
export const GLOSSARY_TEMPO = 84;

const TREBLE = { clef: "treble", fifths: 0, beatsPerBar: 4 } as const;

export const GLOSSARY: GlossaryEntry[] = [
    {
        id: "dotted",
        category: "length",
        shown: {
            ...TREBLE,
            notes: [
                { step: "C", octave: 5, value: "half", dotted: true },
                { step: "A", octave: 4, value: "quarter" },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "C", octave: 5, value: "half" },
                { step: "A", octave: 4, value: "quarter" },
            ],
        },
    },
    {
        id: "tie",
        category: "length",
        shown: {
            ...TREBLE,
            notes: [
                { step: "G", octave: 4, value: "quarter", tie: "start" },
                { step: "G", octave: 4, value: "quarter", tie: "stop" },
                { step: "E", octave: 4, value: "half" },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "G", octave: 4, value: "quarter" },
                { step: "G", octave: 4, value: "quarter" },
                { step: "E", octave: 4, value: "half" },
            ],
        },
    },
    {
        id: "rest",
        category: "length",
        shown: {
            ...TREBLE,
            notes: [
                { step: "C", octave: 5, value: "quarter" },
                { step: null, value: "quarter" },
                { step: "G", octave: 4, value: "quarter" },
                { step: null, value: "quarter" },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "C", octave: 5, value: "quarter" },
                { step: "G", octave: 4, value: "quarter" },
            ],
        },
    },
    {
        id: "staccato",
        category: "touch",
        shown: {
            ...TREBLE,
            notes: [
                { step: "C", octave: 5, value: "quarter", articulation: "staccato" },
                { step: "B", octave: 4, value: "quarter", articulation: "staccato" },
                { step: "A", octave: 4, value: "quarter", articulation: "staccato" },
                { step: "G", octave: 4, value: "quarter", articulation: "staccato" },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "C", octave: 5, value: "quarter" },
                { step: "B", octave: 4, value: "quarter" },
                { step: "A", octave: 4, value: "quarter" },
                { step: "G", octave: 4, value: "quarter" },
            ],
        },
    },
    {
        id: "accent",
        category: "touch",
        shown: {
            ...TREBLE,
            notes: [
                { step: "G", octave: 4, value: "quarter", accent: true },
                { step: "A", octave: 4, value: "quarter" },
                { step: "B", octave: 4, value: "quarter", accent: true },
                { step: "A", octave: 4, value: "quarter" },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "G", octave: 4, value: "quarter" },
                { step: "A", octave: 4, value: "quarter" },
                { step: "B", octave: 4, value: "quarter" },
                { step: "A", octave: 4, value: "quarter" },
            ],
        },
    },
    {
        // A slur tells the hands to carry one note into the next without a gap. The
        // written lengths are unchanged, so there is nothing to compare it against —
        // the difference lives in the playing, not in the arithmetic.
        id: "slur",
        category: "touch",
        shown: {
            ...TREBLE,
            notes: [
                { step: "E", octave: 4, value: "quarter", slur: "start" },
                { step: "F", octave: 4, value: "quarter" },
                { step: "G", octave: 4, value: "quarter" },
                { step: "A", octave: 4, value: "quarter", slur: "stop" },
            ],
        },
        plain: null,
    },
    {
        id: "piano",
        category: "loudness",
        shown: {
            ...TREBLE,
            notes: [
                { step: "E", octave: 5, value: "quarter", dynamic: "p" },
                { step: "D", octave: 5, value: "quarter" },
                { step: "C", octave: 5, value: "half" },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "E", octave: 5, value: "quarter" },
                { step: "D", octave: 5, value: "quarter" },
                { step: "C", octave: 5, value: "half" },
            ],
        },
    },
    {
        id: "forte",
        category: "loudness",
        shown: {
            ...TREBLE,
            notes: [
                { step: "E", octave: 5, value: "quarter", dynamic: "f" },
                { step: "D", octave: 5, value: "quarter" },
                { step: "C", octave: 5, value: "half" },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "E", octave: 5, value: "quarter" },
                { step: "D", octave: 5, value: "quarter" },
                { step: "C", octave: 5, value: "half" },
            ],
        },
    },
    {
        // The key signature does its work invisibly: nothing is marked on the F, and
        // it sounds a semitone higher all the same. The comparison is the same written
        // notes with no signature at all.
        id: "keySignature",
        category: "place",
        shown: {
            clef: "treble",
            fifths: 1,
            beatsPerBar: 4,
            notes: [
                { step: "G", octave: 4, value: "quarter" },
                { step: "A", octave: 4, value: "quarter" },
                { step: "B", octave: 4, value: "quarter" },
                { step: "F", octave: 5, value: "quarter" },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "G", octave: 4, value: "quarter" },
                { step: "A", octave: 4, value: "quarter" },
                { step: "B", octave: 4, value: "quarter" },
                { step: "F", octave: 5, value: "quarter" },
            ],
        },
    },
    {
        id: "accidental",
        category: "place",
        shown: {
            ...TREBLE,
            notes: [
                { step: "F", octave: 4, value: "quarter", accidental: "sharp", alter: 1 },
                { step: "F", octave: 4, value: "quarter", accidental: "natural", alter: 0 },
                { step: "B", octave: 4, value: "quarter", accidental: "flat", alter: -1 },
                { step: "B", octave: 4, value: "quarter", accidental: "natural", alter: 0 },
            ],
        },
        plain: {
            ...TREBLE,
            notes: [
                { step: "F", octave: 4, value: "quarter" },
                { step: "F", octave: 4, value: "quarter" },
                { step: "B", octave: 4, value: "quarter" },
                { step: "B", octave: 4, value: "quarter" },
            ],
        },
    },
    {
        // Three beats to the bar, and you can hear where each bar begins. There is no
        // "without" reading — a bar has to have some number of beats.
        id: "timeSignature",
        category: "place",
        shown: {
            clef: "treble",
            fifths: 0,
            beatsPerBar: 3,
            notes: [
                { step: "C", octave: 5, value: "quarter", accent: true },
                { step: "E", octave: 4, value: "quarter" },
                { step: "G", octave: 4, value: "quarter" },
                { step: "C", octave: 5, value: "quarter", accent: true },
                { step: "E", octave: 4, value: "quarter" },
                { step: "G", octave: 4, value: "quarter" },
            ],
        },
        plain: null,
    },
    {
        // Which half of the piano the dots mean. Nothing to compare — the clef is the
        // question the notes are an answer to.
        id: "bassClef",
        category: "place",
        shown: {
            clef: "bass",
            fifths: 0,
            beatsPerBar: 4,
            notes: [
                { step: "C", octave: 3, value: "quarter" },
                { step: "G", octave: 2, value: "quarter" },
                { step: "C", octave: 3, value: "quarter" },
                { step: "E", octave: 3, value: "quarter" },
            ],
        },
        plain: null,
    },
];

export type GlossaryStrike = {
    note: number;
    velocity: number;
    duration: number; // seconds
    delay: number; // seconds from the start of the phrase
};

// Turn a written bar into what the speakers should do with it. Rests take their time
// without sounding; a tie sounds once and holds through its continuation.
export function performSnippet(snippet: Snippet, tempo = GLOSSARY_TEMPO): GlossaryStrike[] {
    const beatSeconds = 60 / tempo;
    const strikes: GlossaryStrike[] = [];
    let elapsedQuarters = 0;
    // A dynamic stands until another replaces it, so it is carried down the phrase.
    let dynamicVolume: number | null = null;
    let insideSlur = false;
    // The last index already sounded as part of a tie, so its continuation is silent.
    let heldThrough = -1;

    snippet.notes.forEach((note, index) => {
        if (note.dynamic) {
            dynamicVolume = DYNAMIC_VELOCITY[note.dynamic];
        }
        if (note.slur === "start") {
            insideSlur = true;
        }
        // The slur's last note is where the joining stops, so it is not itself carried on.
        const slurred = insideSlur && note.slur !== "stop";
        if (note.slur === "stop") {
            insideSlur = false;
        }

        const midi = snippetMidi(note, snippet.fifths);
        if (midi !== null && index > heldThrough) {
            // A tie's first note sounds for the whole chain's length. Only two-note ties
            // are modelled: one note carries a single tie mark, which is all the examples
            // need and all a beginner meets first.
            let last = index;
            let quarters = noteQuarters(note);
            const next = snippet.notes[index + 1];
            if (note.tie === "start" && next?.tie === "stop") {
                last = index + 1;
                quarters += noteQuarters(next);
            }
            heldThrough = last;
            const played = performNote(
                {
                    quarters,
                    articulation: note.articulation ?? "none",
                    accent: note.accent === true,
                    marcato: false,
                    slurred,
                    dynamicVolume,
                },
                tempo,
            );
            strikes.push({
                note: midi,
                velocity: played.velocity,
                duration: played.durationSeconds,
                delay: elapsedQuarters * beatSeconds,
            });
        }
        elapsedQuarters += noteQuarters(note);
    });
    return strikes;
}

// How long the whole phrase takes, so a player can be shown as busy for exactly as
// long as it sounds.
export function snippetSeconds(snippet: Snippet, tempo = GLOSSARY_TEMPO): number {
    const quarters = snippet.notes.reduce((sum, note) => sum + noteQuarters(note), 0);
    return quarters * (60 / tempo);
}

export function entriesIn(category: GlossaryCategory): GlossaryEntry[] {
    return GLOSSARY.filter((entry) => entry.category === category);
}

export function entryById(id: string): GlossaryEntry | null {
    return GLOSSARY.find((entry) => entry.id === id) ?? null;
}
