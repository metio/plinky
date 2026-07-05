// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Builds score-partwise MusicXML at runtime from a list of notes, so a generated
// phrase renders and practices on the same OSMD engine as the bundled scores. The
// static finger-exercise scores are emitted by the same model offline in
// dev/gen-exercise-scores.mjs.

export type BuiltPitch = { step: string; octave: number; alter: number };

// The rhythmic values a generated phrase uses — quarters, on-beat eighth pairs and
// half notes, enough variety to make the timing read without dotted notes or ties.
export type RhythmValue = "eighth" | "quarter" | "half";

// <divisions> per quarter note. Two lets an eighth note be an integer duration.
export const DIVISIONS = 2;

export const RHYTHM: Record<RhythmValue, { divisions: number; type: string }> = {
    eighth: { divisions: 1, type: "eighth" },
    quarter: { divisions: 2, type: "quarter" },
    half: { divisions: 4, type: "half" },
};

// A pitch paired with how long it sounds.
export type BuiltNote = { pitch: BuiltPitch; value: RhythmValue };

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

// The diatonic alteration a key signature applies to a letter, so notes are spelled
// from plain letters and the signature supplies the sharps and flats.
export function alterFor(letter: string, fifths: number): number {
    if (fifths > 0) {
        return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
    }
    if (fifths < 0) {
        return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0;
    }
    return 0;
}

function escapeXml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function noteXml(note: BuiltNote, staff?: number): string {
    const { pitch, value } = note;
    const { divisions, type } = RHYTHM[value];
    const alter = pitch.alter === 0 ? "" : `<alter>${pitch.alter}</alter>`;
    const staffTag = staff ? `<staff>${staff}</staff>` : "";
    return `      <note><pitch><step>${pitch.step}</step>${alter}<octave>${pitch.octave}</octave></pitch><duration>${divisions}</duration><type>${type}</type>${staffTag}</note>`;
}

export type ScoreSpec = {
    title: string;
    fifths: number;
    beatsPerBar: number;
    treble: BuiltNote[];
    // When present, a second (bass) staff turns the score into a grand staff.
    bass?: BuiltNote[];
};

// Groups a note stream into measures by accumulating durations up to a barful. The
// caller emits notes that land on barlines (no note crosses one), so the running
// total always closes a measure exactly.
function intoMeasures(notes: BuiltNote[], beatsPerBar: number): BuiltNote[][] {
    const barDivisions = beatsPerBar * DIVISIONS;
    const measures: BuiltNote[][] = [];
    let current: BuiltNote[] = [];
    let filled = 0;
    for (const note of notes) {
        current.push(note);
        filled += RHYTHM[note.value].divisions;
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

// One measure's attributes block, emitted only on the first measure.
function attributesXml(spec: ScoreSpec): string {
    const time = `<time><beats>${spec.beatsPerBar}</beats><beat-type>4</beat-type></time>`;
    const key = `<key><fifths>${spec.fifths}</fifths></key>`;
    if (!spec.bass) {
        return `<attributes><divisions>${DIVISIONS}</divisions>${key}${time}<clef><sign>G</sign><line>2</line></clef></attributes>`;
    }
    return `<attributes><divisions>${DIVISIONS}</divisions>${key}${time}<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
}

export function buildScore(spec: ScoreSpec): string {
    const trebleMeasures = intoMeasures(spec.treble, spec.beatsPerBar);
    const bassMeasures = spec.bass ? intoMeasures(spec.bass, spec.beatsPerBar) : null;
    const backup = spec.beatsPerBar * DIVISIONS;
    // Span the longer hand so a bass line that outlasts the treble isn't truncated.
    const measureCount = Math.max(trebleMeasures.length, bassMeasures?.length ?? 0);
    const measures = Array.from({ length: measureCount }, (_, index) => {
        const number = index + 1;
        const attributes = number === 1 ? `      ${attributesXml(spec)}\n` : "";
        const trebleNotes = trebleMeasures[index] ?? [];
        const treble = trebleNotes
            .map((note) => noteXml(note, bassMeasures ? 1 : undefined))
            .join("\n");
        let body = `${attributes}${treble}`;
        if (bassMeasures) {
            const bass = (bassMeasures[index] ?? []).map((note) => noteXml(note, 2)).join("\n");
            // The backup rewinds the cursor over the treble notes so the bass staff starts
            // at the same beat. An empty treble measure leaves the cursor at the bar start,
            // so no backup is needed — and emitting one there would rewind before the bar.
            const rewind =
                trebleNotes.length > 0 ? `\n      <backup><duration>${backup}</duration></backup>` : "";
            body += `${rewind}\n${bass}`;
        }
        return `    <measure number="${number}">\n${body}\n    </measure>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>${escapeXml(spec.title)}</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
${measures.join("\n")}
  </part>
</score-partwise>
`;
}
