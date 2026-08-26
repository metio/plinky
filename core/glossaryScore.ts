// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// MusicXML for the glossary's one-bar examples.
//
// This is a second emitter alongside musicxmlBuild, and deliberately so: that one
// takes a stream of plain notes and bars it up into a playable exercise, while these
// examples are hand-written single bars whose whole point is the mark on the note —
// a staccato dot, a slur, a tie, a dynamic. Teaching those to the exercise builder
// would grow the type every generated drill depends on to carry fields only the
// glossary ever sets.
//
// Examples render on the same OSMD engine as real scores, so the symbol a reader
// meets here is drawn exactly as it will be in a piece.

import { alterFor, midiOf } from "./notes";

// <divisions> per quarter note. Four lets a sixteenth be an integer duration and a
// dotted quarter come out exact (6), which two would not.
export const DIVISIONS = 4;

export type NoteValue = "sixteenth" | "eighth" | "quarter" | "half" | "whole";

const VALUE_DIVISIONS: Record<NoteValue, number> = {
    sixteenth: 1,
    eighth: 2,
    quarter: 4,
    half: 8,
    whole: 16,
};

// The mark on a note. Length articulations and the accent are independent — a note
// can be both — which is why they are separate fields rather than one enum.
// The natural letter each white key carries; black keys have none, and nothing that uses
// this staffs one — spelling a black key would mean choosing between a sharp and a flat,
// a decision these callers are not making.
export const NATURAL_OF: readonly (string | null)[] = [
    "C",
    null,
    "D",
    null,
    "E",
    "F",
    null,
    "G",
    null,
    "A",
    null,
    "B",
];

export type SnippetNote = {
    // The written pitch, or null for a rest.
    step: string | null;
    octave?: number;
    alter?: number;
    value: NoteValue;
    // A dot lengthens the note by half again.
    dotted?: boolean;
    articulation?: "staccato" | "tenuto";
    accent?: boolean;
    // Slurs and ties are both drawn as a curve, and telling them apart is most of
    // what a beginner needs: a slur joins different pitches, a tie joins the same
    // one into a single longer sound.
    slur?: "start" | "stop";
    tie?: "start" | "stop";
    // A dynamic takes effect at this note and stands until the next one.
    dynamic?: "p" | "f";
    // Force the accidental to be drawn. A pitch already carried by the key signature
    // is not normally re-marked, so an example about accidentals has to ask.
    accidental?: "sharp" | "flat" | "natural";
    // Hold it past its written length.
    fermata?: boolean;
    // The beam joining fast notes into a beat group. Written out rather than left to the
    // engraver, so the example about beams draws the beam it is about.
    beam?: "begin" | "continue" | "end";
    // A hairpin opening at this note and closing at the one carrying "stop".
    wedge?: "crescendo" | "diminuendo" | "stop";
    // The shape the notehead is drawn as. Round unless a score asks otherwise: a
    // shape-note edition draws each degree of the scale as its own shape, so a singer
    // reads the degree off the page rather than working it out from the key. It is a
    // reading aid and nothing else — the pitch and the length are unchanged, which is why
    // nothing outside the engraver ever looks at this.
    notehead?: "do" | "re" | "mi" | "fa" | "so" | "la" | "ti";
};

export type Snippet = {
    clef: "treble" | "bass";
    // Sharps (positive) or flats (negative) in the key signature.
    fifths: number;
    beatsPerBar: number;
    notes: SnippetNote[];
    // Wrap the whole example in repeat barlines, and play it twice — the mark means "go
    // back and do that again", so an example that sounded once would contradict itself.
    repeat?: boolean;
};

// How many divisions a note occupies, dot included.
export function noteDivisions(note: SnippetNote): number {
    const base = VALUE_DIVISIONS[note.value];
    return note.dotted ? base + base / 2 : base;
}

// The note's written length in quarter notes — what the performance rules measure.
export function noteQuarters(note: SnippetNote): number {
    return noteDivisions(note) / DIVISIONS;
}

function pitchXml(note: SnippetNote): string {
    if (note.step === null) {
        return "<rest/>";
    }
    const alter = note.alter ? `<alter>${note.alter}</alter>` : "";
    return `<pitch><step>${note.step}</step>${alter}<octave>${note.octave ?? 4}</octave></pitch>`;
}

// The <notations> block gathers everything drawn on or around the notehead. It is
// omitted entirely when there is nothing to draw — an empty one is invalid.
function notationsXml(note: SnippetNote): string {
    const articulations: string[] = [];
    if (note.articulation) {
        articulations.push(`<${note.articulation}/>`);
    }
    if (note.accent) {
        articulations.push("<accent/>");
    }
    const parts: string[] = [];
    if (note.tie) {
        parts.push(`<tied type="${note.tie}"/>`);
    }
    if (note.slur) {
        parts.push(`<slur number="1" type="${note.slur}"/>`);
    }
    if (articulations.length > 0) {
        parts.push(`<articulations>${articulations.join("")}</articulations>`);
    }
    if (note.fermata) {
        parts.push("<fermata/>");
    }
    return parts.length > 0 ? `<notations>${parts.join("")}</notations>` : "";
}

function noteXml(note: SnippetNote): string {
    // <tie> is the sounding instruction and <tied> (inside notations) is the drawn
    // curve; MusicXML wants both, and OSMD reads the drawn one.
    const tie = note.tie ? `<tie type="${note.tie}"/>` : "";
    const dot = note.dotted ? "<dot/>" : "";
    const accidental = note.accidental ? `<accidental>${note.accidental}</accidental>` : "";
    const beam = note.beam ? `<beam number="1">${note.beam}</beam>` : "";
    const notehead = note.notehead ? `<notehead>${note.notehead}</notehead>` : "";
    // Child order is fixed by the MusicXML schema: pitch, duration, tie, type, dot,
    // accidental, notehead, beam, then notations. A notehead written out of order is
    // dropped rather than rejected, so the example would draw round notes and look right
    // enough to pass a glance.
    return `      <note>${pitchXml(note)}<duration>${noteDivisions(note)}</duration>${tie}<type>${note.value}</type>${dot}${accidental}${notehead}${beam}${notationsXml(note)}</note>`;
}

// A dynamic or a hairpin is a direction placed under the staff, written just before the
// note it takes effect at.
function directionXml(note: SnippetNote): string {
    const parts: string[] = [];
    if (note.dynamic) {
        parts.push(`<dynamics><${note.dynamic}/></dynamics>`);
    }
    if (note.wedge) {
        parts.push(`<wedge type="${note.wedge}"/>`);
    }
    return parts
        .map(
            (type) =>
                `      <direction placement="below"><direction-type>${type}</direction-type></direction>\n`,
        )
        .join("");
}

function clefXml(clef: Snippet["clef"]): string {
    return clef === "bass"
        ? "<clef><sign>F</sign><line>4</line></clef>"
        : "<clef><sign>G</sign><line>2</line></clef>";
}

// Split the note stream into bars. Examples are written to fill their bars exactly,
// so a note never straddles a barline.
function intoMeasures(notes: SnippetNote[], beatsPerBar: number): SnippetNote[][] {
    const barDivisions = beatsPerBar * DIVISIONS;
    const measures: SnippetNote[][] = [];
    let current: SnippetNote[] = [];
    let filled = 0;
    for (const note of notes) {
        current.push(note);
        filled += noteDivisions(note);
        if (filled >= barDivisions) {
            measures.push(current);
            current = [];
            filled = 0;
        }
    }
    if (current.length > 0) {
        measures.push(current);
    }
    return measures;
}

export function buildSnippet(snippet: Snippet): string {
    const measures = intoMeasures(snippet.notes, snippet.beatsPerBar);
    const body = measures.map((notes, index) => {
        // The repeat's two barlines belong to the first and last bars of the example.
        const open =
            snippet.repeat && index === 0
                ? `      <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>\n`
                : "";
        const close =
            snippet.repeat && index === measures.length - 1
                ? `\n      <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>`
                : "";
        const attributes =
            index === 0
                ? `      <attributes><divisions>${DIVISIONS}</divisions><key><fifths>${snippet.fifths}</fifths></key><time><beats>${snippet.beatsPerBar}</beats><beat-type>4</beat-type></time>${clefXml(snippet.clef)}</attributes>\n`
                : "";
        const written = notes.map((note) => `${directionXml(note)}${noteXml(note)}`).join("\n");
        return `    <measure number="${index + 1}">\n${attributes}${open}${written}${close}\n    </measure>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
${body.join("\n")}
  </part>
</score-partwise>
`;
}

// The MIDI number a written note sounds, key signature included. Used by the audio
// demo rather than the drawing, so an example can sound the sharp its key signature
// implies without spelling it on every note.
export function snippetMidi(note: SnippetNote, fifths: number): number | null {
    if (note.step === null) {
        return null;
    }
    // An explicit accidental on the note overrides what the key signature would do.
    const alter =
        note.alter ??
        (note.accidental ? accidentalAlter(note.accidental) : alterFor(note.step, fifths));
    return midiOf(note.step, note.octave ?? 4, alter);
}

function accidentalAlter(accidental: NonNullable<SnippetNote["accidental"]>): number {
    return accidental === "sharp" ? 1 : accidental === "flat" ? -1 : 0;
}
