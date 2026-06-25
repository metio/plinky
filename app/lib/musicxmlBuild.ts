// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Builds score-partwise MusicXML at runtime from a list of quarter-note pitches,
// so the generated sprint phrase renders and practices on the same OSMD engine as
// the bundled scores. The static finger-exercise scores are emitted by the same
// model offline in dev/gen-exercise-scores.mjs.

export type BuiltPitch = { step: string; octave: number; alter: number };

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

function noteXml(pitch: BuiltPitch, staff?: number): string {
    const alter = pitch.alter === 0 ? "" : `<alter>${pitch.alter}</alter>`;
    const staffTag = staff ? `<staff>${staff}</staff>` : "";
    return `      <note><pitch><step>${pitch.step}</step>${alter}<octave>${pitch.octave}</octave></pitch><duration>1</duration><type>quarter</type>${staffTag}</note>`;
}

export type ScoreSpec = {
    title: string;
    fifths: number;
    beatsPerBar: number;
    treble: BuiltPitch[];
    // When present, a second (bass) staff turns the score into a grand staff.
    bass?: BuiltPitch[];
};

// One measure's attributes block, emitted only on the first measure.
function attributesXml(spec: ScoreSpec): string {
    const time = `<time><beats>${spec.beatsPerBar}</beats><beat-type>4</beat-type></time>`;
    const key = `<key><fifths>${spec.fifths}</fifths></key>`;
    if (!spec.bass) {
        return `<attributes><divisions>1</divisions>${key}${time}<clef><sign>G</sign><line>2</line></clef></attributes>`;
    }
    return `<attributes><divisions>1</divisions>${key}${time}<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
}

export function buildScore(spec: ScoreSpec): string {
    const per = spec.beatsPerBar;
    const measures: string[] = [];
    for (let start = 0; start < spec.treble.length; start += per) {
        const number = measures.length + 1;
        const attributes = number === 1 ? `      ${attributesXml(spec)}\n` : "";
        const trebleNotes = spec.treble
            .slice(start, start + per)
            .map((pitch) => noteXml(pitch, spec.bass ? 1 : undefined))
            .join("\n");
        let body = `${attributes}${trebleNotes}`;
        if (spec.bass) {
            const bassNotes = spec.bass
                .slice(start, start + per)
                .map((pitch) => noteXml(pitch, 2))
                .join("\n");
            body += `\n      <backup><duration>${per}</duration></backup>\n${bassNotes}`;
        }
        measures.push(`    <measure number="${number}">\n${body}\n    </measure>`);
    }
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
