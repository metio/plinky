// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type Incipit, layoutIncipit } from "./incipit";
import { BOOMWHACKER_SET } from "./pitchColor";

// The geometry of an incipit mark: where every line and notehead goes, in pixels, for a
// given staff space. Two renderers draw it — the React mark a list row carries and the
// SVG string a piece's social card is painted from — and a drawing they share is what
// keeps the two from drifting: a mark on the page and the mark on its card are one shape.
//
// Every measurement is a multiple of the space, so the mark rescales by changing that
// one number and nothing drifts out of proportion.

export type Line = { x1: number; y1: number; x2: number; y2: number };

export type HeadDrawing = {
    x: number;
    y: number;
    rx: number;
    ry: number;
    // Which of the seven note names the head is, for a renderer colouring by name.
    letter: number;
    hollow: boolean;
    stem: Line | null;
    ledgers: Line[];
    // An accidental beside the head: straight strokes for a sharp, a stroke and a curve
    // for a flat, or nothing. Drawn rather than typed — the musical symbols are missing
    // from plenty of the fonts that might paint this, and a glyph that silently falls
    // back would put a box where an accidental belongs.
    accidental: { lines: Line[]; paths: string[] } | null;
};

export type IncipitDrawing = {
    width: number;
    height: number;
    staff: Line[];
    // Stroke widths, so a renderer draws hairlines and strokes at the drawing's scale.
    hairline: number;
    stroke: number;
    heads: HeadDrawing[];
};

function accidentalFor(x: number, y: number, alter: number, space: number) {
    if (alter === 0) {
        return null;
    }
    if (alter > 0) {
        return {
            lines: [
                {
                    x1: x - 0.24 * space,
                    y1: y - 0.9 * space,
                    x2: x - 0.24 * space,
                    y2: y + 0.7 * space,
                },
                {
                    x1: x + 0.24 * space,
                    y1: y - 1 * space,
                    x2: x + 0.24 * space,
                    y2: y + 0.6 * space,
                },
                {
                    x1: x - 0.5 * space,
                    y1: y - 0.2 * space,
                    x2: x + 0.5 * space,
                    y2: y - 0.34 * space,
                },
                {
                    x1: x - 0.5 * space,
                    y1: y + 0.28 * space,
                    x2: x + 0.5 * space,
                    y2: y + 0.14 * space,
                },
            ],
            paths: [],
        };
    }
    return {
        lines: [
            { x1: x - 0.2 * space, y1: y - 1.3 * space, x2: x - 0.2 * space, y2: y + 0.6 * space },
        ],
        paths: [
            `M ${x - 0.2 * space} ${y + 0.1 * space} q ${0.85 * space} ${-0.65 * space} ${0.6 * space} ${0.15 * space} q ${-0.18 * space} ${0.48 * space} ${-0.6 * space} ${0.35 * space}`,
        ],
    };
}

export function drawIncipit(incipit: Incipit, space: number): IncipitDrawing {
    const SLOT = 2.5 * space; // one notehead to the next
    const MARGIN = 3 * space; // room above and below for ledger lines
    const STAFF = 4 * space;
    const EDGE = space; // the staff runs a little past the outer notes
    const HEAD_RX = 0.62 * space;
    const HEAD_RY = 0.46 * space;
    const STEM = 3.2 * space;
    const glyphs = layoutIncipit(incipit);
    const width = 2 * EDGE + glyphs.length * SLOT;
    const height = STAFF + 2 * MARGIN;
    // The bottom staff line, measured down from the top of the drawing.
    const baseline = MARGIN + STAFF;
    const yOf = (staffY: number) => baseline - staffY * space;
    return {
        width,
        height,
        staff: [0, 1, 2, 3, 4].map((line) => ({ x1: 0, y1: yOf(line), x2: width, y2: yOf(line) })),
        hairline: 0.11 * space,
        stroke: 0.15 * space,
        heads: glyphs.map((glyph) => {
            const x = EDGE + glyph.slot * SLOT + SLOT / 2;
            const y = yOf(glyph.y);
            // Stems turn at the middle line, the way an engraver sets them: up from the
            // low half of the staff, down from the high.
            const up = glyph.y < 2;
            const stemX = up ? x + HEAD_RX : x - HEAD_RX;
            return {
                x,
                y,
                rx: HEAD_RX,
                ry: HEAD_RY,
                letter: glyph.letter,
                hollow: glyph.hollow,
                stem: glyph.stem
                    ? { x1: stemX, y1: y, x2: stemX, y2: up ? y - STEM : y + STEM }
                    : null,
                ledgers: glyph.ledgers.map((line) => ({
                    x1: x - 1.1 * space,
                    y1: yOf(line),
                    x2: x + 1.1 * space,
                    y2: yOf(line),
                })),
                accidental: accidentalFor(x - 1.3 * space, y, glyph.alter, space),
            };
        }),
    };
}

// The colour a head takes when coloured by its name: the seven note names in order are
// the first seven entries of the set the score itself is coloured from, so a mark and its
// piece agree.
export function headColor(letter: number): string {
    return BOOMWHACKER_SET[letter] ?? "currentColor";
}

const lineAttrs = (line: Line) => `x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"`;

// The drawing as SVG markup, in one ink, for the places that cannot render a component:
// a card painted by a headless browser. The React mark draws the same drawing from the
// same primitives.
export function incipitSvg(
    incipit: Incipit,
    { space, ink, colored = false }: { space: number; ink: string; colored?: boolean },
): string {
    const drawing = drawIncipit(incipit, space);
    const staff = drawing.staff.map((line) => `<line ${lineAttrs(line)}/>`).join("");
    const heads = drawing.heads
        .map((head) => {
            const fill = colored ? headColor(head.letter) : ink;
            const ledgers = head.ledgers
                .map(
                    (line) =>
                        `<line ${lineAttrs(line)} stroke="${ink}" stroke-width="${drawing.hairline}"/>`,
                )
                .join("");
            const accidental = head.accidental
                ? `<g stroke="${ink}" stroke-width="${drawing.stroke}" fill="none" stroke-linecap="round">${head.accidental.lines
                      .map((line) => `<line ${lineAttrs(line)}/>`)
                      .join(
                          "",
                      )}${head.accidental.paths.map((d) => `<path d="${d}"/>`).join("")}</g>`
                : "";
            const ellipse = `<ellipse cx="${head.x}" cy="${head.y}" rx="${head.rx}" ry="${head.ry}" transform="rotate(-18 ${head.x} ${head.y})" fill="${head.hollow ? "none" : fill}" stroke="${head.hollow ? fill : "none"}" stroke-width="${drawing.stroke}"/>`;
            const stem = head.stem
                ? `<line ${lineAttrs(head.stem)} stroke="${ink}" stroke-width="${drawing.stroke}"/>`
                : "";
            return `<g>${ledgers}${accidental}${ellipse}${stem}</g>`;
        })
        .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${drawing.width} ${drawing.height}" width="${drawing.width}" height="${drawing.height}" role="img" aria-hidden="true"><g stroke="${ink}" stroke-width="${drawing.hairline}" opacity="0.5">${staff}</g>${heads}</svg>`;
}
