// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generates the finger-exercise catalogue — scales (major, natural/harmonic/melodic
// minor) and arpeggios (major, minor, dominant 7th) in every key, each as a one-
// octave right-hand form and a two-octave both-hands form. Spelling comes from the
// key signature (raised degrees applied on top), so it is correct by construction.
//
// Output is one gzipped pack (all MusicXML, keyed by id) plus a metadata manifest,
// under public/exercises/ — small enough to fetch once and keep every exercise
// available offline. Each is graded by the same engine the app uses, and the
// manifest is ordered easiest-first within each grade. Needs a DOM for the cost
// engine, so it runs under tsx with linkedom. Run: `npm run exercises`.

import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync, strToU8 } from "fflate";
import { DOMParser } from "linkedom";
// @ts-expect-error - the cost engine calls the global DOMParser, as in the browser
globalThis.DOMParser = DOMParser;
const { gradeOf, rawDifficulty } = await import("../app/lib/scoreDifficulty.ts");

const OUT = "public/exercises";
const ORDER = ["C", "D", "E", "F", "G", "A", "B"];
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

// [display key, tonic letter, key-signature fifths]
const MAJOR: [string, string, number][] = [
    ["C", "C", 0],
    ["G", "G", 1],
    ["D", "D", 2],
    ["A", "A", 3],
    ["E", "E", 4],
    ["B", "B", 5],
    ["Gb", "G", -6],
    ["Db", "D", -5],
    ["Ab", "A", -4],
    ["Eb", "E", -3],
    ["Bb", "B", -2],
    ["F", "F", -1],
];
// Natural minor uses the relative major's key signature.
const MINOR: [string, string, number][] = [
    ["A", "A", 0],
    ["E", "E", 1],
    ["B", "B", 2],
    ["F#", "F", 3],
    ["C#", "C", 4],
    ["G#", "G", 5],
    ["Eb", "E", -6],
    ["Bb", "B", -5],
    ["F", "F", -4],
    ["C", "C", -3],
    ["G", "G", -2],
    ["D", "D", -1],
];

type Note = { letter: string; octave: number; alter: number };

function alterFor(letter: string, fifths: number): number {
    if (fifths > 0) {
        return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
    }
    if (fifths < 0) {
        return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0;
    }
    return 0;
}

// The scale degree (0 = tonic … 6 = leading tone) of a letter within a key.
function degreeOf(letter: string, tonic: string): number {
    return (ORDER.indexOf(letter) - ORDER.indexOf(tonic) + 7) % 7;
}

// `octaves` diatonic octaves ascending from the tonic (octave number ticks over at
// C, matching scientific pitch), ending on the top tonic.
function diatonic(tonic: string, fifths: number, octaves: number): Note[] {
    let index = ORDER.indexOf(tonic);
    let octave = 4;
    const notes: Note[] = [];
    const total = octaves * 7;
    for (let step = 0; step < total; step++) {
        const letter = ORDER[index]!;
        notes.push({ letter, octave, alter: alterFor(letter, fifths) });
        index = (index + 1) % 7;
        if (index === 0) {
            octave += 1;
        }
    }
    const top = ORDER[index]!;
    notes.push({ letter: top, octave, alter: alterFor(top, fifths) });
    return notes;
}

const raiseDegrees = (notes: Note[], tonic: string, degrees: number[]): Note[] =>
    notes.map((note) =>
        degrees.includes(degreeOf(note.letter, tonic)) ? { ...note, alter: note.alter + 1 } : note,
    );

// A scale up then down (the top note is not repeated at the turn).
function upDown(ascending: Note[], descending: Note[]): Note[] {
    return ascending.concat([...descending].reverse().slice(1));
}

function scaleNotes(mode: string, tonic: string, fifths: number, octaves: number): Note[] {
    const base = diatonic(tonic, fifths, octaves);
    if (mode === "harmonic-minor") {
        const raised = raiseDegrees(base, tonic, [6]);
        return upDown(raised, raised);
    }
    if (mode === "melodic-minor") {
        // Raised 6th and 7th going up, natural coming down.
        return upDown(raiseDegrees(base, tonic, [5, 6]), base);
    }
    return upDown(base, base);
}

// Pick the chord tones (every other scale step) across all octaves, ending on the
// top tonic; `seventh` lowers the leading tone to a flat 7th (dominant 7th chord).
function arpeggioNotes(tonic: string, fifths: number, octaves: number, seventh: boolean): Note[] {
    const scale = diatonic(tonic, fifths, octaves);
    const up: Note[] = [];
    for (let o = 0; o < octaves; o++) {
        up.push(scale[o * 7]!, scale[o * 7 + 2]!, scale[o * 7 + 4]!);
        if (seventh) {
            const lead = scale[o * 7 + 6]!;
            up.push({ ...lead, alter: lead.alter - 1 });
        }
    }
    up.push(scale[octaves * 7]!);
    return upDown(up, up);
}

function noteXml(note: Note, staff?: number): string {
    const alter = note.alter === 0 ? "" : `<alter>${note.alter}</alter>`;
    const staffTag = staff ? `<staff>${staff}</staff>` : "";
    return `<note><pitch><step>${note.letter}</step>${alter}<octave>${note.octave}</octave></pitch><duration>1</duration><type>quarter</type>${staffTag}</note>`;
}

// One staff's worth of notes, as quarter-note measures. The first measure carries
// the attributes (and the second staff/clef for two-hand exercises) plus a tempo.
function partXml(notes: Note[], fifths: number, hands: boolean): string {
    const perBar = 4;
    const measures: string[] = [];
    for (let i = 0; i < notes.length; i += perBar) {
        const number = measures.length + 1;
        const attrs =
            number === 1
                ? `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key><time><beats>${perBar}</beats><beat-type>4</beat-type></time>${
                      hands
                          ? `<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>`
                          : `<clef><sign>G</sign><line>2</line></clef>`
                  }</attributes><sound tempo="90"/>`
                : "";
        if (hands) {
            const slice = notes.slice(i, i + perBar);
            const right = slice.map((note) => noteXml(note, 1)).join("");
            const left = slice
                .map((note) => noteXml({ ...note, octave: note.octave - 2 }, 2))
                .join("");
            measures.push(
                `    <measure number="${number}">${attrs}${right}<backup><duration>${slice.length}</duration></backup>${left}</measure>`,
            );
        } else {
            const body = notes
                .slice(i, i + perBar)
                .map((note) => noteXml(note))
                .join("");
            measures.push(`    <measure number="${number}">${attrs}${body}</measure>`);
        }
    }
    return measures.join("\n");
}

function scoreXml(title: string, fifths: number, notes: Note[], hands: boolean): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>${title}</work-title></work>
  <identification><creator type="composer">Finger exercise</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
${partXml(notes, fifths, hands)}
  </part>
</score-partwise>
`;
}

const slugKey = (key: string) => key.replace("#", "sharp").replace("b", "flat").toLowerCase();
const niceKey = (key: string) => key.replace("#", "♯").replace("b", "♭");

type Exercise = { id: string; title: string; xml: string; grade: number; cost: number };
const exercises: Exercise[] = [];

function add(id: string, title: string, fifths: number, notes: Note[], hands: boolean): void {
    const xml = scoreXml(title, fifths, notes, hands);
    exercises.push({ id, title, xml, grade: gradeOf(id, xml), cost: rawDifficulty(xml) });
}

// `base` keeps the original ids (scale-c-major, arpeggio-a-minor) so existing track
// links still resolve; the two-octave both-hands form gets a -2oct variant.
function emitForms(baseId: string, baseTitle: string, fifths: number, oneHand: Note[], bothHands: Note[]): void {
    add(baseId, baseTitle, fifths, oneHand, false);
    add(`${baseId}-2oct`, `${baseTitle} · 2 octaves`, fifths, bothHands, true);
}

for (const [key, tonic, fifths] of MAJOR) {
    emitForms(
        `scale-${slugKey(key)}-major`,
        `${niceKey(key)} major scale`,
        fifths,
        scaleNotes("major", tonic, fifths, 1),
        scaleNotes("major", tonic, fifths, 2),
    );
    emitForms(
        `arpeggio-${slugKey(key)}-major`,
        `${niceKey(key)} major arpeggio`,
        fifths,
        arpeggioNotes(tonic, fifths, 1, false),
        arpeggioNotes(tonic, fifths, 2, false),
    );
    emitForms(
        `arpeggio-${slugKey(key)}-dom7`,
        `${niceKey(key)} dominant 7th arpeggio`,
        fifths,
        arpeggioNotes(tonic, fifths, 1, true),
        arpeggioNotes(tonic, fifths, 2, true),
    );
}

for (const [key, tonic, fifths] of MINOR) {
    for (const [mode, label] of [
        ["minor", "natural minor"],
        ["harmonic-minor", "harmonic minor"],
        ["melodic-minor", "melodic minor"],
    ]) {
        emitForms(
            `scale-${slugKey(key)}-${mode}`,
            `${niceKey(key)} ${label} scale`,
            fifths,
            scaleNotes(mode!, tonic, fifths, 1),
            scaleNotes(mode!, tonic, fifths, 2),
        );
    }
    emitForms(
        `arpeggio-${slugKey(key)}-minor`,
        `${niceKey(key)} minor arpeggio`,
        fifths,
        arpeggioNotes(tonic, fifths, 1, false),
        arpeggioNotes(tonic, fifths, 2, false),
    );
}

// Easiest-first within each grade, so a learner climbs gradually.
exercises.sort((a, b) => a.grade - b.grade || a.cost - b.cost);

const manifest = exercises.map((exercise) => ({
    id: exercise.id,
    title: exercise.title,
    grade: exercise.grade,
    tempo: 90,
    beatsPerBar: 4,
}));
const pack: Record<string, string> = {};
for (const exercise of exercises) {
    pack[exercise.id] = exercise.xml;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest));
writeFileSync(`${OUT}/pack.json.gz`, gzipSync(strToU8(JSON.stringify(pack))));

const histogram = Array.from({ length: 9 }, () => 0);
for (const exercise of exercises) {
    histogram[exercise.grade] = (histogram[exercise.grade] ?? 0) + 1;
}
console.log(`Wrote ${exercises.length} exercises to ${OUT}/ (manifest.json + pack.json.gz).`);
console.log("Grade histogram:");
for (let g = 1; g <= 8; g++) {
    console.log(`  grade ${g}: ${histogram[g]}`);
}
