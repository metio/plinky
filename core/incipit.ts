// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A piece's opening bar, as a handful of noteheads on a staff fragment. Thematic
// catalogues have identified works this way for two centuries — you recognise a piece
// by how it starts, long before you recognise its title — and it is the one mark that
// is ornament, identifier and reading practice at once.
//
// What it draws: noteheads at their written pitch, hollow from a minim up, with stems,
// ledger lines and any accidental in force. What it deliberately leaves out: flags,
// beams, dots, rests and barlines. At a centimetre tall those are noise rather than
// information — the shape of the opening is what a reader recognises, and an incipit
// has never been a performing edition.
//
// Pure: the XML codec arrives as a parameter, so this runs identically in the browser,
// in the Node tooling that bakes the catalogue, and in tests.

import type { XmlCodec } from "./xml";

// A letter's index within its octave, C through B — the diatonic ladder a staff draws.
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const LETTER_INDEX: Record<string, number> = Object.fromEntries(
    LETTERS.map((letter, index) => [letter, index]),
);

// The lowest line of each clef's staff, as a diatonic index (octave × 7 + letter):
// E4 for the treble, G2 for the bass. Every vertical position is measured from it.
const BOTTOM_LINE: Record<Clef, number> = {
    treble: 4 * 7 + LETTER_INDEX.E!,
    bass: 2 * 7 + LETTER_INDEX.G!,
};

export type Clef = "treble" | "bass";

export type IncipitNote = {
    // Where the notehead sits on the diatonic ladder: octave × 7 + letter index. Two
    // steps to a staff line, so this is what places it without knowing anything about
    // semitones — a B sharp and a C natural are different places on the page.
    diatonic: number;
    // -1 flat, 0 natural, 1 sharp, as written on this note. Only a note carrying its
    // own accidental has a non-zero value; a key signature is not read here.
    alter: number;
    // The written length in quarter notes, which decides a hollow head and a stem.
    quarters: number;
};

export type Incipit = { clef: Clef; notes: IncipitNote[] };

// How many notes an incipit shows. Enough to carry a recognisable opening and few
// enough to stay a mark rather than a score.
export const INCIPIT_NOTES = 8;

function textOf(parent: Element, tag: string): string {
    return parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
}

// The clef of the part's first staff, defaulting to treble — a piano part that omits
// its clef is being read at the top, which is where the melody lives.
function clefOf(measure: Element): Clef {
    for (const clef of Array.from(measure.getElementsByTagName("clef"))) {
        const number = clef.getAttribute("number");
        if (number !== null && number !== "1") {
            continue;
        }
        return textOf(clef, "sign").toUpperCase() === "F" ? "bass" : "treble";
    }
    return "treble";
}

function noteOf(note: Element, divisions: number): IncipitNote | null {
    const pitch = note.getElementsByTagName("pitch")[0];
    if (!pitch) {
        return null;
    }
    const step = textOf(pitch, "step").toUpperCase();
    const octaveText = textOf(pitch, "octave");
    const letter = LETTER_INDEX[step];
    if (letter === undefined || octaveText === "") {
        return null;
    }
    const octave = Number(octaveText);
    const alter = Number(textOf(pitch, "alter") || "0");
    const duration = Number(textOf(note, "duration") || "0");
    if (!Number.isFinite(octave) || !Number.isFinite(alter) || !Number.isFinite(duration)) {
        return null;
    }
    return {
        diatonic: octave * 7 + letter,
        // Anything past a double sharp is a curiosity the mark cannot draw; clamp it
        // rather than stacking glyphs that would not fit.
        alter: Math.max(-1, Math.min(1, Math.trunc(alter))),
        quarters: divisions > 0 ? duration / divisions : 0,
    };
}

// The opening bar of a score's first part, top staff. Returns null for XML that cannot
// be read or a first bar with nothing in it — a caller shows its ordinary row instead,
// so a piece that will not yield a mark never turns into a broken one.
export function readIncipit(codec: XmlCodec, xml: string, limit = INCIPIT_NOTES): Incipit | null {
    const doc = codec.parse(xml);
    const part = doc?.getElementsByTagName("part")[0];
    if (!part) {
        return null;
    }
    let divisions = 1;
    const notes: IncipitNote[] = [];
    let clef: Clef = "treble";
    let seenClef = false;
    for (const measure of Array.from(part.getElementsByTagName("measure"))) {
        const declared = Number(textOf(measure, "divisions") || "0");
        if (Number.isFinite(declared) && declared > 0) {
            divisions = declared;
        }
        if (!seenClef && measure.getElementsByTagName("clef").length > 0) {
            clef = clefOf(measure);
            seenClef = true;
        }
        for (const note of Array.from(measure.getElementsByTagName("note"))) {
            // The other staff of a grand staff, reached through <backup>, is a second
            // voice under the same mark — an incipit shows the top line only.
            if (textOf(note, "staff") !== "" && textOf(note, "staff") !== "1") {
                continue;
            }
            // A chord's upper notes stack on a head that is already placed; the mark
            // draws the line, not the harmony.
            if (note.getElementsByTagName("chord").length > 0) {
                continue;
            }
            const read = noteOf(note, divisions);
            if (read) {
                notes.push(read);
            }
            if (notes.length >= limit) {
                return { clef, notes };
            }
        }
        // A first bar that is only rests (a pickup of silence, an accompaniment
        // entering later) says nothing, so keep reading into the next one.
        if (notes.length > 0) {
            break;
        }
    }
    return notes.length > 0 ? { clef, notes } : null;
}

// A drawn incipit, in the units the renderer uses: one staff space is 1, so a staff is
// 4 tall and every note sits at a whole or half step from the bottom line.
export type IncipitGlyph = {
    // Distance from the bottom staff line, in staff spaces. Half-integers land on a
    // space, integers on a line, and anything outside 0–4 needs ledger lines.
    y: number;
    // Where along the mark it sits, in note slots from the left.
    slot: number;
    // The note's letter, C through B as 0–6 — what its colour is keyed to, so a B
    // sharp is coloured a B and not a C.
    letter: number;
    alter: number;
    // A minim or longer is drawn hollow.
    hollow: boolean;
    // A semibreve carries no stem.
    stem: boolean;
    // Ledger lines this note needs, each at its own distance from the bottom line.
    ledgers: number[];
};

// Whole steps below the bottom line and above the top one need a line under or over
// them; a note far outside the staff needs several.
function ledgersFor(y: number): number[] {
    const lines: number[] = [];
    for (let line = -1; line >= Math.floor(y); line -= 1) {
        lines.push(line);
    }
    for (let line = 5; line <= Math.ceil(y); line += 1) {
        lines.push(line);
    }
    return lines;
}

// Place each note: vertically by its diatonic distance from the clef's bottom line
// (two diatonic steps to a staff space), horizontally one slot at a time. Even spacing
// rather than proportional — the mark is read as a shape, and a semibreve given four
// times the width of a quaver would leave a two-note incipit mostly empty.
export function layoutIncipit(incipit: Incipit): IncipitGlyph[] {
    const bottom = BOTTOM_LINE[incipit.clef];
    return incipit.notes.map((note, slot) => {
        const y = (note.diatonic - bottom) / 2;
        return {
            y,
            slot,
            letter: ((note.diatonic % 7) + 7) % 7,
            alter: note.alter,
            hollow: note.quarters >= 2,
            stem: note.quarters < 4,
            ledgers: ledgersFor(y),
        };
    });
}
