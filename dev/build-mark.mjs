// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes brand/mark/: every form of the mark, as vector, from one description.
//
// The symbol is the designer's Optimised Option 3 in her own colours: three white keys, two
// black ones, the plink falling down the middle key onto its strike point. Every coordinate
// and hex in art() and defs() was measured off her slide, so they are copied here as they
// are and never adjusted by eye. The other forms only place that same drawing: on a circle,
// on a rounded tile, on a full-bleed square, inside a launcher's safe zone, above the name,
// or beside it.
//
// The name is Fredoka at weight 600, converted to outlines so no file here depends on a font
// loading. The outlines come from the variable Fredoka the app ships
// (@fontsource-variable/fredoka): wawoff2 unpacks the WOFF2 into a plain TrueType font, and
// fontkit instances it at weight 600 and lays out the name with the face's own kerning.
// fontkit cannot instance a WOFF2 directly — its WOFF2 reader never applies the variation
// to the outlines — which is why the TrueType step is there.
//
// Every raster Plinky ships is rendered from these files: `npm run icons` (public/),
// `npm run brand` (the rest of brand/), `npm run og` (the per-piece cards) and
// `npm run promo:thumbs`.
//
//   npm run mark            write brand/mark/*.svg
//   npm run mark -- --check fail if any file there is missing or differs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as fontkit from "fontkit";
import { decompress } from "wawoff2";
import {
    DOT,
    drawnWordmark,
    TITTLE,
    TRACKING,
    tittleCircle,
    WORDMARK_PARTS,
} from "../core/wordmark.ts";
import { tokenValue } from "./brandTokens.mjs";

const OUT = "brand/mark";
const FONT = "node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2";
const CHECK = process.argv.includes("--check");

// Her indigo, the ground of every form.
const GROUND = "#3200af";
// The name's ink on a light ground, which is also the app header's (--color-brand-ink).
// On indigo and on any dark ground the name is white.
const NAME_INK = tokenValue(await readFile("app/app.css", "utf8"), "", "--color-brand-ink");

// One prefix for the gradient and filter ids. Each file is its own document, so they only
// have to be unique within it.
const ID = "p";

function art() {
    const whiteKey = (x, w) =>
        `<rect x="${x}" y="30.5" width="${w}" height="44.9" rx="3.1" fill="#b0bdff"/><rect x="${x}" y="28.5" width="${w}" height="45" rx="3.1" fill="#fdfdff"/>`;
    const blackKey = (x) =>
        `<rect x="${x}" y="27" width="12" height="33.4" rx="3.1" fill="#4b4be2"/><rect x="${x}" y="25.3" width="12" height="33.6" rx="3.1" fill="url(#${ID}b)"/>`;
    return (
        `${whiteKey(23, 14)}${whiteKey(40.5, 19)}${whiteKey(63, 14)}` +
        `<rect x="49.33" y="28.5" width="1.34" height="37" fill="url(#${ID}l)"/>` +
        `<circle cx="50" cy="65.7" r="3.2" fill="#a836fe"/>` +
        `${blackKey(32.4)}${blackKey(55.6)}` +
        `<circle cx="50" cy="13.4" r="3.4" fill="#fff" opacity=".85" filter="url(#${ID}h)"/>` +
        `<circle cx="50" cy="13.4" r="2.3" fill="#fff"/>` +
        `<circle cx="50" cy="19.6" r=".8" fill="#fff"/><circle cx="50" cy="22.8" r=".8" fill="#fff"/><circle cx="50" cy="26" r=".8" fill="#fff"/>`
    );
}

function defs(glowY = 23) {
    return (
        `<defs>` +
        `<radialGradient id="${ID}g" cx="50" cy="${glowY}" r="50" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0" stop-color="#b07cff"/><stop offset=".2" stop-color="#8a7cff"/>` +
        `<stop offset=".45" stop-color="#6a5cf0" stop-opacity=".85"/><stop offset=".75" stop-color="#4012c0" stop-opacity=".45"/>` +
        `<stop offset="1" stop-color="${GROUND}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `<linearGradient id="${ID}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a1fd8"/><stop offset=".42" stop-color="#20166d"/><stop offset="1" stop-color="#1c1649"/></linearGradient>` +
        `<linearGradient id="${ID}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f6efe"/><stop offset="1" stop-color="#a739fe"/></linearGradient>` +
        `<filter id="${ID}h" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="1.1"/></filter>` +
        `<filter id="${ID}s" x="-.1" y="-.3" width="1.2" height="1.8"><feDropShadow dx="0" dy=".7" stdDeviation=".8" flood-color="#12004a" flood-opacity=".45"/></filter>` +
        `</defs>`
    );
}

const circle = `<circle cx="50" cy="50" r="50" fill="${GROUND}"/><circle cx="50" cy="50" r="50" fill="url(#${ID}g)"/>`;
// On her own indigo the circle has no edge to show, so it wears the thin light ring from her
// square avatar.
const RING = `<circle cx="50" cy="50" r="48.6" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/>`;

// The name, as one path.
const face = fontkit
    .create(Buffer.from(await decompress(await readFile(FONT))))
    .getVariation({ wght: 600 });
const EM = face.unitsPerEm;

// Two decimals of a unit is far below a pixel at any size these files are drawn.
const num = (value) => String(Math.round(value * 100) / 100);

// The dot is drawn rather than set, so it has to sit where the face puts its own: measured
// here off Fredoka 600's i on every run, and held to core/wordmark's TITTLE, which the header,
// the thumbnails and the video set it from. A face update that moves the tittle fails here
// rather than leaving four surfaces with the dot a little off.
{
    const contours = (glyph) => {
        const boxes = [];
        for (const { command, args } of glyph.path.commands) {
            if (command === "moveTo") boxes.push({ x: [], y: [] });
            for (let k = 0; k + 1 < args.length; k += 2) {
                boxes.at(-1)?.x.push(args[k]);
                boxes.at(-1)?.y.push(args[k + 1]);
            }
        }
        return boxes.map(({ x, y }) => ({
            minX: Math.min(...x),
            maxX: Math.max(...x),
            minY: Math.min(...y),
        }));
    };
    const [tittle] = contours(face.layout("i").glyphs[0]).sort((a, b) => b.minY - a.minY);
    const [stem] = contours(face.layout(WORDMARK_PARTS.stem).glyphs[0]);
    const measured = {
        size: (tittle.maxX - tittle.minX) / EM,
        baseAbove: tittle.minY / EM,
        stemCentre: (stem.minX + stem.maxX) / 2 / EM,
    };
    for (const [key, value] of Object.entries(measured)) {
        if (Math.abs(value - TITTLE[key]) > 0.002) {
            console.error(
                `Fredoka's tittle has moved: ${key} is ${value.toFixed(4)}em, core/wordmark says ${TITTLE[key]}.`,
            );
            process.exit(1);
        }
    }
}

// The name's outlines starting at `x` on `baseline`, `size` units tall, with `spacing` units
// after every letter but the last, set with the dotless stem. Returns the path, the name's
// width and the dot over its i.
function outline(x, baseline, size, spacing) {
    const scale = size / EM;
    const run = face.layout(drawnWordmark(false));
    const parts = [];
    let pen = x;
    let dot = null;
    run.glyphs.forEach((glyph, index) => {
        if (index === WORDMARK_PARTS.before.length) dot = tittleCircle(pen, baseline, size);
        const at = (px, py) => `${num(pen + px * scale)} ${num(baseline - py * scale)}`;
        for (const { command, args } of glyph.path.commands) {
            if (command === "moveTo") parts.push(`M${at(args[0], args[1])}`);
            else if (command === "lineTo") parts.push(`L${at(args[0], args[1])}`);
            else if (command === "quadraticCurveTo")
                parts.push(`Q${at(args[0], args[1])} ${at(args[2], args[3])}`);
            else if (command === "bezierCurveTo")
                parts.push(
                    `C${at(args[0], args[1])} ${at(args[2], args[3])} ${at(args[4], args[5])}`,
                );
            else if (command === "closePath") parts.push("Z");
        }
        pen += run.positions[index].xAdvance * scale;
        if (index < run.glyphs.length - 1) pen += spacing;
    });
    return { d: parts.join(""), width: pen - x, dot };
}

// The dot over the i, in the mark's pink whatever the ground.
const dotOf = ({ dot }, extra = "") =>
    `<circle fill="${DOT}"${extra} cx="${num(dot.cx)}" cy="${num(dot.cy)}" r="${num(dot.r)}"/>`;

// Where CSS puts the baseline in a line box as tall as the type (line-height 1): the face's
// ascent and descent centred in the box, which is how the lockups were set on her board.
const baselineIn = (size) =>
    (size - ((face.ascent - face.descent) / EM) * size) / 2 + (face.ascent / EM) * size;

function file(width, height, body) {
    return (
        `<!--\nSPDX-FileCopyrightText: The Plinky Authors\nSPDX-License-Identifier: AGPL-3.0-or-later\n-->\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="0 0 ${num(width)} ${num(height)}" role="img" aria-label="Plinky">` +
        `${body}</svg>\n`
    );
}

// The symbol on its circle: the header, the social avatar's crop, the unfurled cards.
const symbol = (ring) => file(100, 100, `${defs()}${circle}${art()}${ring ? RING : ""}`);

// The name inside the circle, the symbol scaled to 0.813 and placed so its strike point lands
// on the circle's centre. Her letter-spacing here is 1.07 at 21.5, her 0.05em rounded.
function badge(ring) {
    const run = outline(0, 77.6, 21.5, 1.07);
    // Centred the way SVG's text-anchor centres: on the advance, trailing spacing included.
    const name = outline(50 - (run.width + 1.07) / 2, 77.6, 21.5, 1.07);
    return file(
        100,
        100,
        `${defs(17)}${circle}<g transform="translate(9.35 -3.4) scale(.813)">${art()}</g>` +
            `<path fill="#fff" filter="url(#${ID}s)" d="${name.d}"/>` +
            `${dotOf(name, ` filter="url(#${ID}s)"`)}${ring ? RING : ""}`,
    );
}

// The symbol beside the name: a 64-unit circle, a 14-unit gap, the name at 44 centred on it.
function lockup({ ring, ink, tracking }) {
    const SYMBOL = 64;
    const GAP = 14;
    const SIZE = 44;
    const top = (SYMBOL - SIZE) / 2;
    const name = outline(SYMBOL + GAP, top + baselineIn(SIZE), SIZE, tracking * SIZE);
    return file(
        SYMBOL + GAP + name.width,
        SYMBOL,
        `<g transform="scale(${SYMBOL / 100})">${defs()}${circle}${art()}${ring ? RING : ""}</g>` +
            `<path fill="${ink}" d="${name.d}"/>${dotOf(name)}`,
    );
}

// The launcher's safe zone. A launcher that masks crops to its own shape — a circle, a
// squircle — and everything outside the middle circle of radius 40% is its to take. So the
// ground reaches every edge and the drawing is scaled by 0.8 about the centre, which brings
// its farthest point, the plink's glow, to 34 units from the centre. The glow's gradient is
// drawn over the whole frame, since a gradient cut at the drawing's old edge would show as a
// line across the icon.
const MASK_SAFE = 0.8;
const maskable = file(
    100,
    100,
    `${defs()}<rect width="100" height="100" fill="${GROUND}"/>` +
        `<g transform="translate(${num(50 * (1 - MASK_SAFE))} ${num(50 * (1 - MASK_SAFE))}) scale(${MASK_SAFE})">` +
        `<rect x="-12.5" y="-12.5" width="125" height="125" fill="url(#${ID}g)"/>${art()}</g>`,
);

const FILES = {
    // The symbol on its circle.
    "symbol.svg": symbol(false),
    // The same on an indigo ground, with her ring.
    "symbol-ringed.svg": symbol(true),
    // The app icon: the rounded tile a launcher or a tab shows as it is.
    "tile.svg": file(
        100,
        100,
        `${defs()}<rect width="100" height="100" rx="22" fill="${GROUND}"/><rect width="100" height="100" rx="22" fill="url(#${ID}g)"/>${art()}`,
    ),
    // Full bleed, for anything that rounds or circles the corners itself: Apple's touch
    // icon, and a profile picture every platform crops to a circle. Inside that circle it is
    // exactly the symbol.
    "square.svg": file(
        100,
        100,
        `${defs()}<rect width="100" height="100" fill="${GROUND}"/><rect width="100" height="100" fill="url(#${ID}g)"/>${art()}`,
    ),
    "maskable.svg": maskable,
    // The name inside the circle, for places that show the mark without a caption.
    "badge.svg": badge(false),
    "badge-ringed.svg": badge(true),
    // The symbol beside the name: on a light ground, on indigo, on a dark ground.
    "lockup-light.svg": lockup({ ring: false, ink: NAME_INK, tracking: TRACKING.light }),
    "lockup-indigo.svg": lockup({ ring: true, ink: "#fff", tracking: TRACKING.dark }),
    "lockup-dark.svg": lockup({ ring: false, ink: "#fff", tracking: TRACKING.dark }),
};

if (CHECK) {
    const stale = [];
    for (const [name, content] of Object.entries(FILES)) {
        const current = await readFile(`${OUT}/${name}`, "utf8").catch(() => null);
        if (current !== content) stale.push(name);
    }
    if (stale.length > 0) {
        console.error(`brand/mark is out of date: ${stale.join(", ")}.`);
        console.error("Run `npm run mark` and commit the result.");
        process.exit(1);
    }
    console.log(`brand/mark: all ${Object.keys(FILES).length} files are current.`);
} else {
    await mkdir(OUT, { recursive: true });
    for (const [name, content] of Object.entries(FILES)) {
        await writeFile(`${OUT}/${name}`, content);
    }
    console.log(`brand/mark: wrote ${Object.keys(FILES).join(", ")}.`);
}
