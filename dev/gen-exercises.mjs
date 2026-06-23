// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generates the finger-exercise catalog songs under songs/: all 12 major scales
// and arpeggios (one octave, up and down) plus a few hand-authored patterns.
// Scales/arpeggios use only diatonic letters and rely on the ABC key signature
// (K:) to apply accidentals, so they are correct by construction. Run from the
// repo root: node dev/gen-exercises.mjs  (then re-run `npm run songs`).
import { writeFileSync } from "node:fs";

const ORDER = ["C", "D", "E", "F", "G", "A", "B"];
const CURRICULUM = "finger-exercises";

function noteAt(letterIndex, octave) {
    const letter = ORDER[letterIndex];
    if (octave >= 5) return letter.toLowerCase() + "'".repeat(octave - 5);
    if (octave <= 3) return letter + ",".repeat(4 - octave);
    return letter;
}

// One ascending octave of diatonic letters from the tonic letter (8 notes).
function octaveUp(tonicLetter) {
    let index = ORDER.indexOf(tonicLetter);
    let octave = 4;
    const notes = [noteAt(index, octave)];
    for (let step = 0; step < 7; step++) {
        index = (index + 1) % 7;
        if (index === 0) octave += 1; // wrapped past B to the next C
        notes.push(noteAt(index, octave));
    }
    return notes;
}

function bars(notes, perBar) {
    const out = [];
    for (let i = 0; i < notes.length; i += perBar) {
        out.push(notes.slice(i, i + perBar).join(" "));
    }
    return `${out.join(" | ")} |`;
}

function write(id, title, description, abc, tempo, beatsPerBar) {
    const song = {
        id,
        title,
        description,
        abc,
        tempo,
        beatsPerBar,
        license: "CC0-1.0",
        curriculums: [CURRICULUM],
    };
    writeFileSync(`songs/${id}.json`, `${JSON.stringify(song, null, 2)}\n`);
}

// The 12 major keys, with the conventional sharp/flat spelling for each.
const KEYS = [
    ["C", "C"],
    ["G", "G"],
    ["D", "D"],
    ["A", "A"],
    ["E", "E"],
    ["B", "B"],
    ["Gb", "G"],
    ["Db", "D"],
    ["Ab", "A"],
    ["Eb", "E"],
    ["Bb", "B"],
    ["F", "F"],
];

// The 12 minor keys (natural minor), with conventional spellings.
const MINOR_KEYS = [
    ["A", "A"],
    ["E", "E"],
    ["B", "B"],
    ["F#", "F"],
    ["C#", "C"],
    ["G#", "G"],
    ["Eb", "E"],
    ["Bb", "B"],
    ["F", "F"],
    ["C", "C"],
    ["G", "G"],
    ["D", "D"],
];

function emitScaleAndArpeggio(key, tonicLetter, mode) {
    const up = octaveUp(tonicLetter);
    const slug = `${key.replace("#", "sharp").replace("b", "flat").toLowerCase()}-${mode}`;
    const name = `${key.replace("#", "♯").replace("b", "♭")} ${mode}`;
    const abcKey = mode === "minor" ? `${key}m` : key;

    const scaleNotes = up.concat([...up].reverse());
    write(
        `scale-${slug}`,
        `${name} scale`,
        "One octave, up and down — the foundation of finger technique.",
        `X:1\nT:${name} scale\nM:4/4\nL:1/4\nK:${abcKey}\n${bars(scaleNotes, 4)}`,
        92,
        4,
    );

    const arp = [up[0], up[2], up[4], up[7]];
    const arpNotes = arp.concat([...arp].reverse());
    write(
        `arpeggio-${slug}`,
        `${name} arpeggio`,
        "The triad, up and down.",
        `X:1\nT:${name} arpeggio\nM:4/4\nL:1/4\nK:${abcKey}\n${bars(arpNotes, 4)}`,
        88,
        4,
    );
}

for (const [key, tonicLetter] of KEYS) {
    emitScaleAndArpeggio(key, tonicLetter, "major");
}
for (const [key, tonicLetter] of MINOR_KEYS) {
    emitScaleAndArpeggio(key, tonicLetter, "minor");
}

write(
    "chromatic-c",
    "Chromatic scale (C)",
    "All twelve semitones, ascending.",
    "X:1\nT:Chromatic scale (C)\nM:4/4\nL:1/8\nK:C\nC ^C D ^D E F ^F G | ^G A ^A B c2 z2 |",
    80,
    4,
);

write(
    "five-finger-c",
    "Five-finger exercise (C)",
    "Fingers 1–5 up and back — the classic warm-up.",
    "X:1\nT:Five-finger exercise (C)\nM:4/4\nL:1/4\nK:C\nC D E F | G F E D | C4 |",
    90,
    4,
);

write(
    "broken-chords-c",
    "Broken chords (C)",
    "The C major triad, one note at a time.",
    "X:1\nT:Broken chords (C)\nM:3/4\nL:1/4\nK:C\nC E G | E G c | G c e | c2 z |",
    100,
    3,
);

write(
    "hanon-1",
    "Hanon No. 1 (excerpt)",
    "The opening figure of Hanon's first exercise, climbing the scale.",
    "X:1\nT:Hanon No. 1\nM:4/4\nL:1/8\nK:C\nC E F G A G F E | D F G A B A G F | E G A B c B A G | F A B c d c B A | G4 z4 |",
    108,
    4,
);

write(
    "thirds-c",
    "Thirds (C major)",
    "Each scale step harmonized a third above.",
    "X:1\nT:Thirds (C major)\nM:2/4\nL:1/4\nK:C\nC E | D F | E G | F A | G B | A c | B d | c e |",
    80,
    2,
);

write(
    "contrary-motion-c",
    "Contrary motion (C)",
    "Both hands start on C and mirror outward, then return.",
    "X:1\nT:Contrary motion (C)\nM:4/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nV:1\nK:C\nC D E F | G F E D | C4 |\nV:2\nC, B,, A,, G,, | F,, G,, A,, B,, | C,4 |",
    80,
    4,
);

console.log("generated finger exercises");
