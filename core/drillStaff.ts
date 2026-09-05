// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spellMidi } from "./notes";
import type { Hand } from "./fingering";

// Renders a fingering drill as MusicXML so it can be read on a real staff. The
// drill is plain C-major quarter notes — single notes and chords — so this stays a
// focused, self-contained builder rather than touching the shared score builder,
// which is one pitch per beat and so can't voice a chord.

// Pitch class → its diatonic letter and accidental. Drills are C-major (white
// keys), but the sharp spelling keeps it correct for any incidental black key.
const QUARTER_DIVISIONS = 2;
const BEATS_PER_BAR = 4;

function noteXml(pitch: number, chord: boolean): string {
    // Sharp-side, the spelling a key of no sharps or flats asks for.
    const spelling = spellMidi(pitch, false);
    const octave = spelling.octave;
    const alter = spelling.alter === 0 ? "" : `<alter>${spelling.alter}</alter>`;
    const chordTag = chord ? "<chord/>" : "";
    return `<note>${chordTag}<pitch><step>${spelling.step}</step>${alter}<octave>${octave}</octave></pitch><duration>${QUARTER_DIVISIONS}</duration><type>quarter</type></note>`;
}

// One column of the drill as a chord: the lowest note carries the beat, the rest
// stack on it with <chord/> so they sound together without advancing time.
function positionXml(pitches: number[]): string {
    return [...pitches]
        .sort((a, b) => a - b)
        .map((pitch, index) => noteXml(pitch, index > 0))
        .join("");
}

export function drillToMusicXml(positions: number[][], hand: Hand): string {
    const clef =
        hand === "left"
            ? "<clef><sign>F</sign><line>4</line></clef>"
            : "<clef><sign>G</sign><line>2</line></clef>";
    const measures: string[] = [];
    for (let start = 0; start < positions.length; start += BEATS_PER_BAR) {
        const number = measures.length + 1;
        const attributes =
            number === 1
                ? `<attributes><divisions>${QUARTER_DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>${BEATS_PER_BAR}</beats><beat-type>4</beat-type></time>${clef}</attributes>`
                : "";
        const notes = positions
            .slice(start, start + BEATS_PER_BAR)
            .map((position) => positionXml(position))
            .join("");
        measures.push(`<measure number="${number}">${attributes}${notes}</measure>`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Drill</part-name></score-part></part-list><part id="P1">${measures.join("")}</part></score-partwise>`;
}
