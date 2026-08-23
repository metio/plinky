// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Gives the artwork back its transparency.
//
// Both marks arrive flattened onto white — a rounded violet square with four white corner
// wedges and no alpha channel. Every icon rendered from one then carries those corners, and
// on any ground that is not white they show as a bright halo: the launcher on a dark phone,
// a tab strip in dark mode, a social card on a dark background.
//
// Cropping to a border-radius does not fix it. A radius is a guess at the artwork's own
// curve, and a guess even slightly tight leaves a sliver of the old background showing all
// the way round — the halo it was meant to remove. So the background is found rather than
// assumed: `core/matte.ts` floods inward from the corners across near-white, which is why
// the piano keys survive. They are white too, and enclosed — and this is also why "make
// every white pixel transparent" cannot be the rule: it would erase the keys and, on the
// lockup, the name.
//
// Run through the browser because that is the only PNG codec here. The pixels come out, the
// decision is made by the tested function in core, and the alpha goes back in.
//
//   npm run mark            write brand/plinky-mark.png and brand/plinky-icon.png
//   npm run mark -- --check fail if either is missing or stale

import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
    flattenedBackground,
    grownBy,
    insideEdgeOf,
    maskedShare,
    narrowedAbove,
} from "../core/matte.ts";

// Two pieces of artwork, each supplied flattened onto white, each keyed the same way. The
// lockup carries the name and goes where there is room to read it; the icon is the same
// mark drawn WITHOUT the name, for the tab, the launcher and the app's own header, where a
// wordmark is a smudge at the size it is worn and the keys need the room it was taking.
//
// Two drawings rather than one derived from the other: an icon cut out of the lockup means
// repainting the ground where the name was and sliding what is left back onto the centre
// line, and the tile's own top highlight comes along with it and lands twice.
// How far from the tile's own colour a pixel may sit and still count as tile, and how far
// the outer silhouette is grown inward before the tile pass runs. The first is wide enough
// to cross the tile's gradient and stop at the keys; the second takes the hairline where
// the white and the violet met, which matches neither rule and is left as a ghost outline
// otherwise. Both measured against the artwork, not guessed.
const TILE_WITHIN = 180;
const EDGE_BLEED = 4;
// Half the width of the falling note's line, measured off the artwork where it crosses a
// white key: 13–15 px at this master size. Everything wider than this above the keys is the
// glow around it, which has nothing to blend into once the tile is gone.
const TRAIL_WIDTH = 15;
// The line's own violet, sampled from the artwork where it crosses the key.
const TRAIL_COLOUR = "#a855f7";
// How much of the picture a white run must span to be a key rather than the falling note.
const KEY_SPAN = 0.1;
// Half the band the trail occupies. The glow measures ~94 px across at the master size, so
// 48 covers it — and it has to stay under half the MIDDLE KEY's own width (~125 px), or the
// band is wider than the key it is drawn on and there is nowhere clean left to read the
// key's colour from.
const TRAIL_CLEAR_HALF = 48;
// The falling note, as proportions of the picture: where the white bubble sits, where it
// lands, how big the landing is and how thick the line between them. Read off the artwork,
// and drawn rather than salvaged — what the artist drew is a glow that only reads against
// the tile it was drawn on, and with the tile gone there is no colour rule that separates
// a halo from the line inside it.
const NOTE_TOP = 0.185;
const NOTE_BOTTOM = 0.7;
const NOTE_RADIUS = 0.027;
const NOTE_LINE = 0.0146;
// The note at the top of the fall, as a multiple of the line's width.
const NOTE_TOP_SCALE = 1.9;

const SOURCES = [
    { source: "brand/source/plinky-mark.png", out: "brand/plinky-mark.png", what: "the lockup" },
    { source: "brand/source/plinky-icon.png", out: "brand/plinky-icon.png", what: "the icon" },
    // The keys alone, with the tile taken away too — for setting the mark ON something that
    // is already violet, where a violet tile has no edge to show and reads as a smudge.
    {
        source: "brand/source/plinky-icon.png",
        out: "brand/plinky-keys.png",
        what: "the keys alone",
        tile: true,
    },
];
// The keyed master is emitted at the largest size anything is rendered from — the brand
// kit's 1024 icon. Keeping it at the source's own 1254 would commit a third more bytes that
// nothing ever reads at that size, and the sources themselves are here for anyone who
// wants them.
const MASTER = 1024;
// The corner wedges come to about a sixteenth of the picture. Far outside this and the
// artwork has changed shape — a full-bleed export, or a different mark — which is something
// to look at rather than to ship.
const EXPECTED = { min: 0.02, max: 0.2 };
// Taking the tile away as well leaves only the keys and the falling note, which is most of
// the picture gone. Far outside this and a pass has either stopped early or eaten the keys.
const EXPECTED_KEYS = { min: 0.55, max: 0.9 };

// One pixel's colour, for sampling the tile's own violet out of the artwork rather than
// naming a hex that a redrawn mark would silently invalidate.
const at = (rgba, width, x, y) => {
    const i = (y * width + x) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2]];
};

const check = process.argv.includes("--check");
const browser = await chromium.launch();
const page = await browser.newPage();

let stale = false;
let middleKeyTop = 0;
let drawn = null;
for (const { source, out, what, tile } of SOURCES) {
    const bytes = await readFile(source);
    await page.setContent(`<img id="mark" src="data:image/png;base64,${bytes.toString("base64")}">`);

    const size = await page.evaluate(async () => {
        const img = document.getElementById("mark");
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        globalThis.__canvas = canvas;
        return { width: canvas.width, height: canvas.height };
    });

    // Out as raw bytes rather than an array: a million pixels of JSON is minutes of
    // serialising.
    const raw = await page.evaluate(() => {
        const canvas = globalThis.__canvas;
        const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        let binary = "";
        for (let at = 0; at < data.length; at += 4096) {
            binary += String.fromCharCode.apply(null, data.subarray(at, at + 4096));
        }
        return btoa(binary);
    });
    const rgba = new Uint8ClampedArray(Buffer.from(raw, "base64"));

    // Pass one: the white the artwork was flattened onto, from the corners.
    let mask = flattenedBackground(rgba, size.width, size.height);
    if (tile) {
        // Pass two: the violet tile, seeded from the edge pass one reached and told to
        // match the tile's own colour rather than white — the keys ARE white, and a rule
        // that took both would flood through the tile and eat them.
        const outer = grownBy(mask, size.width, size.height, EDGE_BLEED);
        const inner = flattenedBackground(rgba, size.width, size.height, {
            like: at(rgba, size.width, Math.round(size.width / 2), Math.round(size.height * 0.06)),
            within: TILE_WITHIN,
            seeds: insideEdgeOf(mask, size.width, size.height),
        });
        const both = new Uint8Array(mask.length);
        for (let pixel = 0; pixel < both.length; pixel++) {
            both[pixel] = outer[pixel] === 1 || inner[pixel] === 1 ? 1 : 0;
        }
        // Where the MIDDLE key begins: the first row down the centre that is the key's own
        // white. Everything above it is the falling note over nothing, and the artwork
        // draws that with a glow, a stub above the bubble and dots strung between — a
        // figure that only reads against the tile it was drawn on. It is cleared and drawn
        // again below, from the artwork's own measurements.
        const centreX = Math.round(size.width / 2);
        mask = both;
        drawn = {
            centreX,
            topY: Math.round(size.height * NOTE_TOP),
            bubbleY: Math.round(size.height * NOTE_BOTTOM),
            bubbleR: Math.round(size.width * NOTE_RADIUS),
            lineWidth: Math.round(size.width * NOTE_LINE),
            half: Math.round((TRAIL_CLEAR_HALF * size.width) / 1024),
            // Just outside the band and still inside the middle key, which is only about a
            // key's width across — this is the column every row is judged and repainted
            // from.
            probeX: centreX + Math.round((TRAIL_CLEAR_HALF * size.width) / 1024) + 8,
        };
        mask = both;
    }
    const share = maskedShare(mask);
    console.log(
        `${source}: ${size.width}×${size.height}, background is ${(share * 100).toFixed(1)}% of it`,
    );
    const expected = tile ? EXPECTED_KEYS : EXPECTED;
    if (share < expected.min || share > expected.max) {
        console.error(
            `That is outside the expected ${expected.min * 100}–${expected.max * 100}%. The artwork has changed shape; look at it before shipping.`,
        );
        await browser.close();
        process.exit(1);
    }

    const keyed = await page.evaluate(
        async ({ flags, master, plink }) => {
            const canvas = globalThis.__canvas;
            const context = canvas.getContext("2d");
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const bits = Uint8Array.from(atob(flags), (one) => one.charCodeAt(0));
            for (let pixel = 0; pixel < bits.length; pixel++) {
                if (bits[pixel] === 1) {
                    image.data[pixel * 4 + 3] = 0;
                }
            }
            context.putImageData(image, 0, 0);
            if (plink) {
                // The falling note, drawn rather than salvaged: a white bubble, one line
                // straight down, and the artwork's own pink bubble waiting at the bottom of
                // the key. Every number here is read off the artwork — the line's width
                // where it crosses the key, the middle of the picture, the row the key
                // starts at — so a redrawn mark moves them rather than stranding them.
                const { centreX, topY, bubbleY, bubbleR, lineWidth, colour, repaint } = plink;
                // The trail's band, decided ROW BY ROW from the pixel just beside it.
                //
                // Where that neighbour is solid there IS a key behind the trail, so the
                // band is repainted from it and the key's shading carries straight through
                // — clearing would punch a hole, and a flat fill would read as a patch,
                // because the key shades from top to bottom.
                //
                // Where it is not, there is nothing behind the trail and the band is
                // cleared outright, which takes the glow and the specks strung along the
                // fall with it.
                //
                // Per row, so nothing depends on finding where the key "starts" — a single
                // such row, guessed from the wrong column, moves the boundary and either
                // slots the key or strands the glow.
                const { half, probeX } = plink;
                const key = context.getImageData(0, 0, canvas.width, canvas.height);
                for (let y = 0; y < canvas.height; y++) {
                    const from = (y * canvas.width + probeX) * 4;
                    // Solid, not white. The key's own bottom edge is shaded almost to
                    // black, and a whiteness test calls that "no key here" and clears the
                    // band — which shows the ground straight through the foot of the key.
                    const onKey = key.data[from + 3] > 250;
                    for (let x = centreX - half; x <= centreX + half; x++) {
                        if (x < 0 || x >= canvas.width) continue;
                        const to = (y * canvas.width + x) * 4;
                        if (onKey) {
                            key.data[to] = key.data[from];
                            key.data[to + 1] = key.data[from + 1];
                            key.data[to + 2] = key.data[from + 2];
                            key.data[to + 3] = key.data[from + 3];
                        } else {
                            key.data[to + 3] = 0;
                        }
                    }
                }
                context.putImageData(key, 0, 0);
                context.strokeStyle = colour;
                context.lineWidth = lineWidth;
                context.lineCap = "round";
                context.beginPath();
                context.moveTo(centreX, topY);
                context.lineTo(centreX, bubbleY);
                context.stroke();
                context.fillStyle = colour;
                context.beginPath();
                context.arc(centreX, bubbleY, bubbleR, 0, Math.PI * 2);
                context.fill();
                context.fillStyle = "#ffffff";
                context.beginPath();
                context.arc(centreX, topY, lineWidth * plink.topScale, 0, Math.PI * 2);
                context.fill();
            }
            const scaled = document.createElement("canvas");
            scaled.width = master;
            scaled.height = Math.round((canvas.height / canvas.width) * master);
            const to = scaled.getContext("2d");
            to.imageSmoothingQuality = "high";
            // Scaled with the corners ALREADY transparent, so the edge blends toward
            // nothing rather than toward the white that was just removed — otherwise the
            // halo comes back, softer.
            to.drawImage(canvas, 0, 0, scaled.width, scaled.height);
            return scaled.toDataURL("image/png").split(",")[1];
        },
        {
            flags: Buffer.from(mask).toString("base64"),
            master: MASTER,
            plink: tile && drawn ? { ...drawn, colour: TRAIL_COLOUR, topScale: NOTE_TOP_SCALE } : null,
        },
    );

    const png = Buffer.from(keyed, "base64");
    const existing = await readFile(out).catch(() => null);
    if (check) {
        if (!existing || !existing.equals(png)) {
            console.error(`${out} is ${existing ? "stale" : "missing"}.`);
            stale = true;
        } else {
            console.log(`${out} is up to date.`);
        }
    } else {
        await writeFile(out, png);
        console.log(`Wrote ${out} (${(png.length / 1024).toFixed(0)} KB) — ${what}, keyed.`);
    }
}

if (stale) {
    console.error("Run `npm run mark` and commit the result.");
    await browser.close();
    process.exit(1);
}
await browser.close();
