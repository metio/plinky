// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which notation a piece actually asks you to read.
//
// The glossary explains every mark; this says which of them are in front of you right
// now, so a reader who meets a curve over two notes can find out what it is without
// first knowing it is called a slur. Explaining a symbol at the moment you need it is
// the whole idea — a reference nobody knows to open teaches nobody.
//
// It reads the piece rather than its grade on purpose. The grades measure how hard a
// piece is to PLAY — note density, hand movement, reach — over a catalogue of imported
// public-domain music, not a designed curriculum. Ties, rests, dotted notes, slurs and
// key signatures are as common in grade 1 as in grade 8 (measured: every one of them
// appears in a third to two thirds of pieces at every grade), so "the notation this
// grade introduces" would be a threshold artefact rather than a fact about the music.
// What a given piece contains is simply true.
//
// A text scan, not a parse: the caller already holds the MusicXML as a string, the
// questions are all "does this element occur", and staying off the DOM keeps this pure
// and usable anywhere.

import type { GlossaryCategory } from "./glossary";
import { GLOSSARY } from "./glossary";

// A dynamic mark is only the one the glossary names when it stands alone — <p/> inside
// a <dynamics>, not the p of a <mp/> — so the element is matched whole.
const DYNAMIC = (mark: string) => new RegExp(`<dynamics[^>]*>\\s*<${mark}/>`);

// Where the five lines sit, as a diatonic index (octave × 7 + the letter's place from C).
// A note two steps past a line needs a line of its own to sit on, which is the only way
// to know a ledger line is there: nothing in the file says so, the engraver works it out
// from the pitch and the clef, and so does this.
const STEPS = "CDEFGAB";
const STAVE = {
    // Treble runs E4 to F5, bass G2 to A3 — bottom line to top line.
    treble: { low: 30, high: 38 },
    bass: { low: 18, high: 26 },
};

function needsLedger(xml: string): boolean {
    const lines = /<sign>F<\/sign>/.test(xml) ? STAVE.bass : STAVE.treble;
    const pitches = xml.matchAll(
        /<step>\s*([A-G])\s*<\/step>[\s\S]*?<octave>\s*(-?\d+)\s*<\/octave>/g,
    );
    for (const [, step, octave] of pitches) {
        const index = Number(octave) * 7 + STEPS.indexOf(step ?? "C");
        if (index <= lines.low - 2 || index >= lines.high + 2) {
            return true;
        }
    }
    return false;
}

const PRESENT: Record<string, (xml: string) => boolean> = {
    dotted: (xml) => /<dot\s*\/?>/.test(xml),
    // <tied> is the drawn curve; <tie> alone is the sounding instruction and can appear
    // without anything visible to ask about.
    tie: (xml) => /<tied[\s/>]/.test(xml),
    rest: (xml) => /<rest[\s/>]/.test(xml),
    fermata: (xml) => /<fermata[\s/>]/.test(xml),
    beam: (xml) => /<beam[\s>]/.test(xml),
    staccato: (xml) => /<staccato\s*\/?>/.test(xml),
    tenuto: (xml) => /<tenuto\s*\/?>/.test(xml),
    accent: (xml) => /<accent\s*\/?>/.test(xml),
    slur: (xml) => /<slur[\s/>]/.test(xml),
    piano: (xml) => DYNAMIC("p").test(xml),
    forte: (xml) => DYNAMIC("f").test(xml),
    hairpin: (xml) => /<wedge[\s/>]/.test(xml),
    // A signature of no sharps or flats is C major: nothing on the staff to explain.
    keySignature: (xml) => /<fifths>\s*-?[1-9]\d*\s*<\/fifths>/.test(xml),
    accidental: (xml) => /<accidental[\s>]/.test(xml),
    bassClef: (xml) => /<sign>F<\/sign>/.test(xml),
    ledger: needsLedger,
    repeat: (xml) => /<repeat[\s/>]/.test(xml),
    // Every piece has a time signature, so its presence says nothing. Four beats to the
    // bar is what a reader assumes without being told; anything else is the thing worth
    // pointing at.
    timeSignature: (xml) => {
        const beats = /<beats>\s*(\d+)\s*<\/beats>/.exec(xml);
        return beats !== null && beats[1] !== "4";
    },
};

export type ScoreSymbol = { id: string; category: GlossaryCategory };

// The glossary entries this piece uses, in the glossary's own order so the list reads
// the same way twice and groups by what each mark controls.
export function symbolsInScore(xml: string): ScoreSymbol[] {
    return GLOSSARY.filter((entry) => PRESENT[entry.id]?.(xml) ?? false).map((entry) => ({
        id: entry.id,
        category: entry.category,
    }));
}
