// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A keyboard with notes marked on it, as a picture somebody can keep.
//
// What a teacher actually hands a pupil is a drawing of where the fingers go, and what a
// pupil loses between lessons is exactly that. The app can already show it on screen; the
// missing half is taking it away — into a lesson plan, a printout, a message.
//
// The geometry is the app's own (`keyLane`), so the picture is the instrument the player
// already reads rather than a second drawing of a keyboard that lines up differently.
//
// Pure markup: no DOM, no canvas. The caller rasterises it, which is also what makes it
// testable — the shapes are in the string.
//
// Colours are baked hexes rather than the app's tokens, for the same reason the share
// card bakes its own: an exported file has no stylesheet to read them from, and a picture
// that changed with the reader's theme would be a different picture in every message.

import { isWhite, keyLane, whiteKeys } from "./keyboardGeometry";
import { NOTE_TEXT, noteNameOf, pitchClassOf, type Spelling } from "./theory";

// A marked key, and optionally the finger that plays it.
export type DiagramKey = { note: number; finger?: number };

export type DiagramOptions = {
    // The span drawn. Widen it and the keys get narrower; the marks stay where they are.
    from: number;
    to: number;
    keys: readonly DiagramKey[];
    // A line under the keyboard — the chord's name, the scale, whatever the picture is of.
    caption?: string;
    // Note names on every white key, for a reader who does not yet know them by position.
    noteNames?: boolean;
    spelling?: Spelling;
};

const WIDTH = 1200;
const KEYBED_TOP = 40;
const KEYBED_HEIGHT = 300;
const BLACK_HEIGHT = KEYBED_HEIGHT * 0.62;
const CAPTION_HEIGHT = 96;
// The band a note name occupies at the foot of a white key.
const LABEL_ROOM = 40;

// Roughly how wide a character is as a fraction of the font size, for the sans stack the
// picture asks for. An estimate, because there is no DOM here to measure text with — but a
// generous one, so the guess errs toward a caption that is smaller than it needed to be
// rather than one that runs off the edge.
const CHAR_WIDTH = 0.55;
const CAPTION_SIZE = 46;
// Below this a caption is no longer readable at the size these are printed, so a very long
// one is left to sit tight against the margins rather than shrinking away to nothing.
const CAPTION_MIN = 24;
const MARGIN = 48;

const INK = "#0f172a";
const PAPER = "#fdf6ec";
const WHITE_KEY = "#ffffff";
const BLACK_KEY = "#1e293b";
const EDGE = "#cbd5e1";
const MARK = "#4f46e5";
const MARK_TEXT = "#ffffff";
const LABEL = "#64748b";

function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// The picture, as a self-contained SVG document.
export function svgKeyboardDiagram(options: DiagramOptions): string {
    const { markup, height } = diagramBody(options);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">\
<rect width="${WIDTH}" height="${height}" fill="${PAPER}"/>\
${markup}\
</svg>`;
}

// One keyboard's shapes and the room they need, without the document around them — which
// is what lets a sheet stack several of them on one page. The drawing starts at y=0 and
// paints no background of its own; the page it lands on owns that.
function diagramBody({
    from,
    to,
    keys,
    caption,
    noteNames = false,
    spelling = "sharp",
}: DiagramOptions): { markup: string; height: number } {
    const height = KEYBED_TOP * 2 + KEYBED_HEIGHT + (caption ? CAPTION_HEIGHT : 0);
    const marked = new Map(keys.map((key) => [key.note, key.finger]));
    const x = (pct: number) => (pct / 100) * WIDTH;

    // White keys first so the black ones sit on top of them, which is the order a
    // keyboard is actually built in.
    const order = [...whiteKeys(from, to), ...notesIn(from, to).filter((note) => !isWhite(note))];

    const parts: string[] = [];
    for (const note of order) {
        const lane = keyLane(note, from, to);
        if (!lane) {
            continue;
        }
        const white = lane.white;
        const left = x(lane.leftPct);
        const width = x(lane.widthPct);
        const keyHeight = white ? KEYBED_HEIGHT : BLACK_HEIGHT;
        const hit = marked.has(note);
        parts.push(
            `<rect x="${round(left)}" y="${KEYBED_TOP}" width="${round(width)}" height="${keyHeight}" rx="6" fill="${
                white ? WHITE_KEY : BLACK_KEY
            }" stroke="${EDGE}" stroke-width="2"/>`,
        );
        if (hit) {
            // The mark sits low on the key, where a finger would be, and clear of a black
            // key's foot so a marked white key is never hidden behind one. Where the
            // white keys are also named, it lifts by the height of that line: a mark
            // covering the letter would take away the one thing a reader who does not
            // know the keyboard came for.
            const radius = round(Math.min(width, 56) / 2);
            const centre = round(left + width / 2);
            const labelRoom = noteNames && white ? LABEL_ROOM : 0;
            const cy = KEYBED_TOP + keyHeight - radius - 18 - labelRoom;
            parts.push(`<circle cx="${centre}" cy="${cy}" r="${radius}" fill="${MARK}"/>`);
            const finger = marked.get(note);
            if (finger !== undefined) {
                parts.push(
                    `<text x="${centre}" y="${cy + radius * 0.36}" fill="${MARK_TEXT}" font-family="system-ui,sans-serif" font-size="${round(
                        radius * 1.1,
                    )}" font-weight="700" text-anchor="middle">${finger}</text>`,
                );
            }
        }
        if (noteNames && white) {
            parts.push(
                `<text x="${round(left + width / 2)}" y="${KEYBED_TOP + KEYBED_HEIGHT - 12}" fill="${LABEL}" font-family="system-ui,sans-serif" font-size="26" text-anchor="middle">${escapeXml(
                    NOTE_TEXT[noteNameOf(pitchClassOf(note), spelling)],
                )}</text>`,
            );
        }
    }

    // A caption is centred, so one too long for the picture runs off BOTH edges and loses
    // its ends — and the languages it happens in are exactly the ones this feature was
    // added for. It shrinks to fit instead.
    const captionSize = caption
        ? Math.max(
              CAPTION_MIN,
              Math.min(CAPTION_SIZE, (WIDTH - 2 * MARGIN) / (caption.length * CHAR_WIDTH)),
          )
        : CAPTION_SIZE;
    const captionMarkup = caption
        ? `<text x="${WIDTH / 2}" y="${KEYBED_TOP + KEYBED_HEIGHT + 66}" fill="${INK}" font-family="system-ui,sans-serif" font-size="${round(
              captionSize,
          )}" font-weight="600" text-anchor="middle">${escapeXml(caption)}</text>`
        : "";

    return { markup: `${parts.join("")}${captionMarkup}`, height };
}

function notesIn(from: number, to: number): number[] {
    const notes: number[] = [];
    for (let note = from; note <= to; note++) {
        notes.push(note);
    }
    return notes;
}

// Two decimals is under a thousandth of a key's width and keeps the markup readable.
function round(value: number): number {
    return Math.round(value * 100) / 100;
}

// Several keyboards down one page, under a heading — the worksheet a teacher prints once
// and a pupil keeps.
//
// A key's seven chords are one lesson, not seven pictures: exported one at a time they
// arrive as seven files with no order and no title, and the thing being taught — that
// these belong to each other and follow in this sequence — is exactly what gets lost.
// So the page is the unit, and the caller only says which diagrams go on it.
const SHEET_TITLE_SIZE = 56;
const SHEET_TITLE_ROOM = 120;

export function svgDiagramSheet({
    title,
    diagrams,
}: {
    title: string;
    diagrams: readonly DiagramOptions[];
}): string {
    const bodies = diagrams.map((options) => diagramBody(options));
    const height = SHEET_TITLE_ROOM + bodies.reduce((total, body) => total + body.height, 0);
    // The heading shrinks by the same rule a caption does, and for the same reason: it is
    // centred, so one too long runs off both edges at once.
    const titleSize = Math.max(
        CAPTION_MIN,
        Math.min(SHEET_TITLE_SIZE, (WIDTH - 2 * MARGIN) / (title.length * CHAR_WIDTH)),
    );

    const parts: string[] = [];
    let y = SHEET_TITLE_ROOM;
    for (const body of bodies) {
        parts.push(`<g transform="translate(0,${round(y)})">${body.markup}</g>`);
        y += body.height;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">\
<rect width="${WIDTH}" height="${height}" fill="${PAPER}"/>\
<text x="${WIDTH / 2}" y="${SHEET_TITLE_ROOM - 40}" fill="${INK}" font-family="system-ui,sans-serif" font-size="${round(
        titleSize,
    )}" font-weight="700" text-anchor="middle">${escapeXml(title)}</text>\
${parts.join("")}\
</svg>`;
}
