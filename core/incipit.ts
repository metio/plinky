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
    // -1 flat, 0 natural, 1 sharp: how the note is altered, from the key signature as
    // well as from any accidental written on it. The mark draws no key signature, so the
    // alteration has to travel with the notehead or the pitch it shows is the wrong one.
    alter: number;
    // The written length in quarter notes, which decides a hollow head and a stem.
    quarters: number;
};

export type Incipit = { clef: Clef; notes: IncipitNote[] };

// How many notes an incipit shows. Enough to carry a recognisable opening and few
// enough to stay a mark rather than a score.
export const INCIPIT_NOTES = 8;

// How many bars of MOVING music it will read to find them. A piece that opens on a
// pickup gives one or two notes in its first bar, which is not a shape anybody
// recognises, so the mark runs on into the phrase — but it stops well short of the first
// page, because an opening is what identifies a work and a page is what plays it.
const INCIPIT_BARS = 4;

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
    let bars = 0;
    for (const measure of Array.from(part.getElementsByTagName("measure"))) {
        const before = notes.length;
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
        // A bar of rests — a pickup of silence, an accompaniment entering later — is
        // not one of the bars this is allowed; only bars that gave something count
        // toward the limit, so the mark always carries notes rather than a bar count.
        //
        // Nor does a bar that only says again what the bar before it said. A piece can
        // open on bars of vamp before its theme arrives — Gymnopédie No. 1 holds one
        // chord for four — and four noteheads at one height identify nothing. Those bars
        // are still drawn, because they are how the piece begins, but they do not spend
        // the budget, so the mark reaches the phrase that follows. The note limit stops it
        // either way.
        const previous = notes[before - 1];
        const repeated =
            previous !== undefined &&
            notes.slice(before).every((one) => one.diatonic === previous.diatonic);
        if (notes.length > before && !repeated) {
            bars += 1;
        }
        if (bars >= INCIPIT_BARS) {
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

// ── Baking ───────────────────────────────────────────────────────────────────
// A list of pieces holds ids and titles, not notation, so a row can only carry a mark
// if the mark travels with the catalogue. The encoded form is what the manifest ships:
// one short string per piece, a few dozen bytes, read without fetching the score.
//
// `G` or `F` for the clef, then one note after another: an optional accidental, the
// diatonic position, and a letter for the length. No separators — the letter ends each
// note — because this is multiplied by every piece in the catalogue.
//
// The length is rounded to the nearest of the six common values. The mark draws no
// flags and no dots, and uses the length only to decide a hollow head and a stem, so
// the rounding costs the drawing nothing and keeps the string short.
const LENGTHS: readonly [string, number][] = [
    ["w", 4],
    ["h", 2],
    ["q", 1],
    ["e", 0.5],
    ["s", 0.25],
    ["t", 0.125],
];

const ACCIDENTAL: Record<string, number> = { "#": 1, b: -1 };

function lengthLetter(quarters: number): string {
    let best = LENGTHS[0]!;
    for (const candidate of LENGTHS) {
        // The list runs longest to shortest and a tie takes the later, shorter value:
        // a dotted crotchet sits exactly between a crotchet and a minim, and drawing it
        // as a crotchet keeps the head filled, which is what the page shows.
        if (Math.abs(candidate[1] - quarters) <= Math.abs(best[1] - quarters)) {
            best = candidate;
        }
    }
    return best[0];
}

export function encodeIncipit(incipit: Incipit): string {
    const notes = incipit.notes
        .map((note) => {
            const accidental = note.alter > 0 ? "#" : note.alter < 0 ? "b" : "";
            return `${accidental}${Math.max(0, Math.round(note.diatonic))}${lengthLetter(note.quarters)}`;
        })
        .join("");
    return `${incipit.clef === "bass" ? "F" : "G"}${notes}`;
}

const NOTE_PATTERN = /([#b]?)(\d+)([whqest])/g;

// Null for anything that is not a mark this drew — an older manifest without the field,
// a truncated string, a value from somewhere else. A row then shows its plain self.
export function decodeIncipit(text: string): Incipit | null {
    const clefLetter = text.slice(0, 1);
    if (clefLetter !== "G" && clefLetter !== "F") {
        return null;
    }
    const body = text.slice(1);
    const notes: IncipitNote[] = [];
    let consumed = 0;
    NOTE_PATTERN.lastIndex = 0;
    for (const match of body.matchAll(NOTE_PATTERN)) {
        consumed += match[0].length;
        const length = LENGTHS.find(([letter]) => letter === match[3]);
        notes.push({
            diatonic: Number(match[2]),
            alter: ACCIDENTAL[match[1] ?? ""] ?? 0,
            quarters: length ? length[1] : 1,
        });
    }
    // Every character has to belong to a note, so a string with anything else in it is
    // rejected whole rather than half-read.
    if (notes.length === 0 || consumed !== body.length) {
        return null;
    }
    return { clef: clefLetter === "F" ? "bass" : "treble", notes };
}

// The opening as SOUNDING pitches, in semitones, for asking whether two rows are the same
// piece.
//
// The mark itself records where a notehead sits on the staff plus its accidental, which is
// what drawing it needs — but two transcribers spell the same sound differently, and the
// catalogue's own Für Elise copies prove it: one writes the second note B flat and another
// writes D sharp, the same key under the same finger. Compared as written they disagree on a
// quarter of the opening; compared as sound they are identical.
export function openingSemitones(text: string): number[] {
    const incipit = decodeIncipit(text);
    if (!incipit) {
        return [];
    }
    return incipit.notes.map((note) => {
        const octave = Math.floor(note.diatonic / 7);
        const letter = ((note.diatonic % 7) + 7) % 7;
        return octave * 12 + (STEP_SEMITONES[letter] ?? 0) + note.alter;
    });
}

// Semitones above the octave's C for each letter of the diatonic ladder, C through B.
const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

// Whether two marks open with the same music.
//
// A share of the opening rather than all of it: two transcriptions of one piece differ in
// where they think the first bar ends, so they can carry a different NUMBER of notes, and the
// later ones drift out of step. The first few decide it — which is exactly how a thematic
// catalogue has identified works for two centuries.
export function sameOpening(one: string, other: string, share = 0.75): boolean {
    const a = openingSemitones(one);
    const b = openingSemitones(other);
    const length = Math.min(a.length, b.length);
    if (length < 4) {
        // Too little to tell. Saying "different" is the safe answer: it keeps two rows that
        // might be one piece, where the opposite deletes a piece that is not.
        return false;
    }
    let alike = 0;
    for (let index = 0; index < length; index++) {
        if (a[index] === b[index]) {
            alike += 1;
        }
    }
    return alike / length >= share;
}
