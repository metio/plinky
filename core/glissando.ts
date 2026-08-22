// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { keyPitchClasses } from "./ornament";

// The notes a glissando actually sounds.
//
// A gliss is written as two notes and a line: play everything between them, fast. Printed
// but not played, the page shows a sweep and the ear hears two notes with a gap — and the
// gap is exactly the gesture. Rare in the catalogue (12 pieces), and unmistakable when it
// happens, which is why it is worth having at all.
//
// On a piano a gliss is the back of a fingernail dragged across the keys, so what sounds is
// the keys physically under it rather than a scale somebody chose. That is the white keys —
// or the black ones, for a gliss written on them. Here it is the notes of the key the piece
// is in, which is the same thing in C and the musical answer everywhere else: a gliss that
// swept notes outside the key would be a chromatic run, which is a different gesture and
// takes a different hand.
//
// Like the ornaments and the tremolo, Listen plays the figure and the graded run asks for
// the written notes. Nobody can be graded on a gliss key by key.

// The most notes one sweep may become. Three octaves of a scale is 22 notes; a gliss across
// the whole instrument is real but the cap keeps a mangled file from scheduling hundreds.
const MOST_NOTES = 60;

// The shortest a swept note may last, in quarter notes. A gliss is a gesture rather than a
// rhythm: below this the notes stop being distinguishable and the extra ones cost voices
// for nothing.
const SHORTEST = 0.02;

export type GlissandoNote = { pitch: number; quarters: number };

// The sweep from `from` to `to`, filling the time the written note had.
//
// Both endpoints sound: the gliss starts on the note it is written from and arrives on the
// one it is written to, which is the whole point of the line between them.
export function glissandoNotes(
    from: number,
    to: number,
    quarters: number,
    fifths: number,
): GlissandoNote[] {
    if (quarters <= 0 || from === to) {
        return [];
    }
    const inKey = keyPitchClasses(fifths);
    const step = to > from ? 1 : -1;
    const swept: number[] = [];
    for (let pitch = from; step > 0 ? pitch <= to : pitch >= to; pitch += step) {
        // The endpoints always sound, whatever key they are in — a gliss written from an
        // accidental starts on that accidental.
        if (pitch === from || pitch === to || inKey.has(((pitch % 12) + 12) % 12)) {
            swept.push(pitch);
        }
    }
    if (swept.length < 2) {
        return [];
    }
    // Thin the sweep rather than let it outrun the cap or the shortest playable note, so a
    // gliss across the instrument stays a gesture of the right length instead of a scale
    // that arrives late.
    const room = Math.max(2, Math.min(MOST_NOTES, Math.floor(quarters / SHORTEST)));
    const kept = swept.length <= room ? swept : thin(swept, room);
    const each = quarters / kept.length;
    return kept.map((pitch) => ({ pitch, quarters: each }));
}

// `count` notes spread evenly across `notes`, keeping the first and the last — the two the
// score actually wrote.
function thin(notes: readonly number[], count: number): number[] {
    const last = notes.length - 1;
    const out: number[] = [];
    for (let index = 0; index < count; index++) {
        const at = Math.round((index * last) / (count - 1));
        const pitch = notes[at] as number;
        if (out.at(-1) !== pitch) {
            out.push(pitch);
        }
    }
    return out;
}

// Where the piece asks for a glissando, read off the file's own notes: from the note it
// starts on to the note it arrives at, and the time the pair occupies.
// The sweep, and the note it arrives on. The arrival pitch is carried because it is written
// at a LATER position than the one that spells the figure out.
export type GlissandoSpan = { from: number; to: number; arrivesAt: number };

export function readGlissandos(
    notes: readonly {
        whole: number;
        wholes: number;
        midi: number | null;
        marks: { glissando: "start" | "stop" | null };
    }[],
): GlissandoSpan[] {
    const spans: GlissandoSpan[] = [];
    let open: number | null = null;
    for (const note of notes) {
        if (note.marks.glissando === null || note.midi === null) {
            continue;
        }
        if (note.marks.glissando === "start") {
            open ??= note.whole;
        } else if (open !== null && note.whole > open) {
            spans.push({
                from: open,
                to: note.whole + note.wholes,
                arrivesAt: note.midi,
            });
            open = null;
        }
    }
    return spans;
}
