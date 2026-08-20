// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The seven chords of a key, laid out as one printable page.
//
// A key's chords are a single lesson rather than seven unrelated pictures — that they
// belong to each other, and follow in this order, is the whole of what is being taught.
// Exported one at a time they arrive as seven files with no order and no title, and that
// is precisely the part that goes missing. So this builds the page in one piece.
//
// Pure: it returns what to draw, and `svgDiagramSheet` draws it.

import { isWhite } from "./keyboardGeometry";
import type { DiagramOptions } from "./keyboardDiagram";
import { CHORD_DEGREES, type ChordDegree, degreePitches, NOTE_TEXT, noteNameOf, type Spelling } from "./theory";

// Two octaves hold every triad the key builds, the seventh degree's included.
const SPAN = 24;

// The numeral is the quality: upper case is major, lower case minor, and the ° marks the
// diminished one. So a chord symbol needs nothing the numeral does not already carry, and
// nothing here needs translating — a symbol reads the same in every language, which is
// why the captions are symbols rather than words.
function symbolSuffix(degree: ChordDegree): string {
    if (degree.endsWith("°")) {
        return "°";
    }
    return degree === degree.toLowerCase() ? "m" : "";
}

// A drawn keyboard that begins mid-black-key reads as a cut-off photograph of one, so the
// window is widened outward to the nearest white keys rather than started wherever the
// tonic happens to fall.
function whiteWindow(tonic: number): { from: number; to: number } {
    let from = tonic;
    while (!isWhite(from)) {
        from -= 1;
    }
    let to = from + SPAN;
    while (!isWhite(to)) {
        to += 1;
    }
    return { from, to };
}

// One diagram per degree, in the order the key builds them.
export function diatonicSheetDiagrams(
    tonic: number,
    spelling: Spelling = "sharp",
): DiagramOptions[] {
    const { from, to } = whiteWindow(tonic);
    return CHORD_DEGREES.map((degree) => {
        const pitches = degreePitches(tonic, degree);
        const root = pitches[0] ?? tonic;
        const symbol = `${NOTE_TEXT[noteNameOf(root, spelling)]}${symbolSuffix(degree)}`;
        return {
            from,
            to,
            keys: pitches.map((note) => ({ note })),
            caption: `${degree} · ${symbol}`,
            noteNames: true,
            spelling,
        };
    });
}
