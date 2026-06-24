// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generates the finger-exercise scales and arpeggios as MusicXML under scores/,
// the MusicXML counterpart of dev/gen-exercises.mjs. Each note's accidental comes
// from the key signature (the same model the ABC versions rely on), so the
// spelling is correct by construction. Run from the repo root:
//   node dev/gen-exercise-scores.mjs
import { writeFileSync } from "node:fs";

const ORDER = ["C", "D", "E", "F", "G", "A", "B"];
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

// [display key, tonic letter, key-signature fifths]
const MAJOR = [
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
const MINOR = [
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

// The diatonic alteration a key signature applies to a given letter.
function alterFor(letter, fifths) {
    if (fifths > 0) {
        return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
    }
    if (fifths < 0) {
        return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0;
    }
    return 0;
}

// One ascending octave of diatonic letters from the tonic (8 notes), as
// {letter, octave} with C4 = middle C, matching the ABC octave model.
function octaveUp(tonicLetter) {
    let index = ORDER.indexOf(tonicLetter);
    let octave = 4;
    const notes = [{ letter: ORDER[index], octave }];
    for (let step = 0; step < 7; step++) {
        index = (index + 1) % 7;
        if (index === 0) {
            octave += 1;
        }
        notes.push({ letter: ORDER[index], octave });
    }
    return notes;
}

function noteXml(note, fifths) {
    const alter = alterFor(note.letter, fifths);
    const alterTag = alter === 0 ? "" : `<alter>${alter}</alter>`;
    return `      <note><pitch><step>${note.letter}</step>${alterTag}<octave>${note.octave}</octave></pitch><duration>1</duration><type>quarter</type></note>`;
}

function scoreXml(title, fifths, notes, perBar) {
    const measures = [];
    for (let i = 0; i < notes.length; i += perBar) {
        const number = measures.length + 1;
        const attributes =
            number === 1
                ? `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key><time><beats>${perBar}</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>\n`
                : "";
        const body = notes
            .slice(i, i + perBar)
            .map((note) => noteXml(note, fifths))
            .join("\n");
        measures.push(`    <measure number="${number}">\n      ${attributes}${body}\n    </measure>`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>${title}</work-title></work>
  <identification><creator type="composer">Finger exercise</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
${measures.join("\n")}
  </part>
</score-partwise>
`;
}

function emit(key, tonicLetter, fifths, mode) {
    const up = octaveUp(tonicLetter);
    const slug = `${key.replace("#", "sharp").replace("b", "flat").toLowerCase()}-${mode}`;
    const name = `${key.replace("#", "♯").replace("b", "♭")} ${mode}`;

    const scale = up.concat([...up].reverse());
    writeFileSync(`scores/scale-${slug}.musicxml`, scoreXml(`${name} scale`, fifths, scale, 4));

    const arp = [up[0], up[2], up[4], up[7]];
    const arpeggio = arp.concat([...arp].reverse());
    writeFileSync(
        `scores/arpeggio-${slug}.musicxml`,
        scoreXml(`${name} arpeggio`, fifths, arpeggio, 4),
    );
}

let count = 0;
for (const [key, tonic, fifths] of MAJOR) {
    emit(key, tonic, fifths, "major");
    count += 2;
}
for (const [key, tonic, fifths] of MINOR) {
    emit(key, tonic, fifths, "minor");
    count += 2;
}
console.log(`generated ${count} scale/arpeggio MusicXML scores`);
