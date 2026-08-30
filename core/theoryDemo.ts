// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a theory lesson demonstrates, as one timeline that the page, the speakers and the
// keyboard all read.
//
// They used to read three: the engraver drew a row of half notes derived from the pitch
// set, the player struck every pitch of a phrase at once, and the keyboard lit the whole
// set statically. Nothing reconciled them, so they disagreed in every way three
// independent derivations can. The lesson about note LENGTH played seven identical C's
// simultaneously, which is one note. The lesson about RESTS played both notes together,
// so the silence it exists to teach could not happen. The lesson about the BASS clef
// sounded three notes as a chord, under a keyboard that starts at middle C and so had no
// keys to light. And the lesson about the stave drew three notes in succession while
// playing them as a chord.
//
// One timeline fixes all of it by construction: a step is a moment, and the three views
// are three readings of the same moments rather than three guesses at them.

import {
    type NoteValue,
    type Snippet,
    type SnippetNote,
    noteQuarters,
    snippetMidi,
} from "./glossaryScore";
import { NATURAL_OF } from "./glossaryScore";

// One moment of a demonstration: what sounds, and for how long. No notes is a silence —
// a rest is a fact about the page and about the ear alike, and the only way to teach one
// is to leave it there.
export type DemoStep = {
    notes: number[];
    value: NoteValue;
    // A dot lengthens the note by half again. Carried because a demonstration built from a
    // glossary entry may be ABOUT the dot, and a keyboard that held the key for a plain
    // half note would be illustrating the opposite of what the words say.
    dotted?: boolean;
};

// A whole demonstration: the notes in time, and the two things a reader needs around them
// — a stave to read them on, and a keyboard wide enough to hold them.
export type DemoScore = {
    clef: "treble" | "bass";
    fifths: number;
    steps: DemoStep[];
};

// How a note is spelled on the stave. A pitch is a number and a stave wants a letter, and
// for a black key the letter depends on the key you are in — so the sharp side is written
// as the natural below it plus an accidental, which is what a key of no sharps or flats
// asks for. The lessons here live in C, where that is always right.
function spell(pitch: number): { step: string; octave: number; alter?: number } | null {
    const withinOctave = ((pitch % 12) + 12) % 12;
    const octave = Math.floor(pitch / 12) - 1;
    const natural = NATURAL_OF[withinOctave];
    if (natural) {
        return { step: natural, octave };
    }
    // A black key: the white key below it, sharpened. Never the octave below — B♯ would be
    // the wrong letter and the wrong line.
    const below = NATURAL_OF[withinOctave - 1];
    return below ? { step: below, octave, alter: 1 } : null;
}

// The steps as something the engraver can draw. A step with several notes becomes a
// stacked chord, a step with none becomes a rest, and the drawn length is the sounded one
// because they are the same number.
export function demoSnippet(score: DemoScore, beatsPerBar = 4): Snippet {
    const notes: SnippetNote[] = [];
    for (const step of score.steps) {
        if (step.notes.length === 0) {
            notes.push({ step: null, value: step.value, dotted: step.dotted });
            continue;
        }
        // Low to high, the way a chord is written and the way it is read.
        const sorted = [...step.notes].sort((one, other) => one - other);
        let stacked = false;
        for (const pitch of sorted) {
            const spelled = spell(pitch);
            if (!spelled) {
                continue;
            }
            notes.push({
                ...spelled,
                value: step.value,
                ...(step.dotted === true ? { dotted: true } : {}),
                // An accidental is written out rather than left to the key signature: the
                // lesson about semitones is about the black key, and a reader who cannot
                // see it on the stave is being shown the question without the answer.
                ...(spelled.alter ? { accidental: "sharp" as const } : {}),
                ...(stacked ? { chord: true as const } : {}),
            });
            stacked = true;
        }
    }
    return { clef: score.clef, fifths: score.fifths, beatsPerBar, notes };
}

// How long one written beat lasts when a demonstration is played. Slow enough that a
// whole note is heard as long and a quarter as short, rather than both as "a note".
export const DEMO_BEAT_MS = 620;

// One sounding moment on the clock: what to strike, when, and how long it lasts. The
// player schedules these and the keyboard lights them, so what you hear and what you see
// cannot come apart — they are the same list.
export type DemoMoment = {
    notes: number[];
    atMs: number;
    forMs: number;
};

export function demoMoments(score: DemoScore, beatMs = DEMO_BEAT_MS): DemoMoment[] {
    const moments: DemoMoment[] = [];
    let atMs = 0;
    for (const step of score.steps) {
        const forMs = noteQuarters({ step: null, value: step.value, dotted: step.dotted }) * beatMs;
        // A rest takes its time without sounding, which is the whole of what a rest is.
        if (step.notes.length > 0) {
            moments.push({ notes: step.notes, atMs, forMs });
        }
        atMs += forMs;
    }
    return moments;
}

// Everything the demonstration ever sounds, for the resting state of the keyboard: the
// shape of the scale or the chord, before a reader has pressed anything.
export function demoNotes(score: DemoScore): number[] {
    return [...new Set(score.steps.flatMap((step) => step.notes))].sort((a, b) => a - b);
}

// How long the whole demonstration runs, so the keyboard knows when to go back to showing
// the shape rather than the moment.
export function demoDurationMs(score: DemoScore, beatMs = DEMO_BEAT_MS): number {
    return score.steps.reduce(
        (total, step) =>
            total + noteQuarters({ step: null, value: step.value, dotted: step.dotted }) * beatMs,
        0,
    );
}

// A demonstration built from bare pitches, for the surfaces that have notes rather than a
// written example: the tools bench's scale, chord and interval explorers. Sounded one
// after another when `spread` is set, together otherwise.
export function scoreOf(
    groups: readonly (readonly number[])[],
    options: { spread?: boolean; value?: NoteValue } = {},
): DemoScore {
    const value = options.value ?? "half";
    const steps = groups.flatMap((notes) =>
        options.spread
            ? notes.map((note) => ({ notes: [note], value }))
            : [{ notes: [...notes], value }],
    );
    return { clef: "treble", fifths: 0, steps };
}

// A glossary entry read as a keyboard demonstration.
//
// The two pages describe the same music in different words: a glossary Snippet is written
// as a line of notes for an engraver, and a DemoScore is written as positions in time for
// a keyboard. Neither is wrong and neither converts by assignment, which is why the
// glossary could draw a symbol and never show it under a pair of hands.
//
// The dot travels, because for one entry the dot IS the subject. So does a chord: a
// SnippetNote flagged `chord` sounds WITH the note before it rather than after it, exactly
// as MusicXML means it, and flattening that into a sequence would turn an interval into a
// melody.
export function demoOf(snippet: Snippet): DemoScore {
    const steps: DemoStep[] = [];
    for (const note of snippet.notes) {
        const midi = snippetMidi(note, snippet.fifths);
        const sounding = steps.at(-1);
        if (note.chord === true && sounding !== undefined) {
            if (midi !== null) {
                sounding.notes.push(midi);
            }
            continue;
        }
        steps.push({
            notes: midi === null ? [] : [midi],
            value: note.value,
            ...(note.dotted === true ? { dotted: true } : {}),
        });
    }
    return { clef: snippet.clef, fifths: snippet.fifths, steps };
}
