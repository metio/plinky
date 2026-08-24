// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Gives the artwork its transparency, where it does not already have it.
//
// Some of the marks arrive flattened onto white — a rounded violet square with four white
// corner wedges and no alpha channel. Every icon rendered from one then carries those
// corners, and on any ground that is not white they show as a bright halo: the launcher on
// a dark phone, a tab strip in dark mode, a social card on a dark background.
//
// Cropping to a border-radius does not fix it. A radius is a guess at the artwork's own
// curve, and a guess even slightly tight leaves a sliver of the old background showing all
// the way round — the halo it was meant to remove. So the background is found rather than
// assumed: `core/matte.ts` floods inward from the corners across near-white, which is why
// the piano keys survive. They are white too, and enclosed — and this is also why "make
// every white pixel transparent" cannot be the rule: it would erase the keys and, on the
// lockup, the name.
//
// Artwork that already carries an alpha channel is left alone. That is the better way to
// receive it and the reason to ask: a drawing with real transparency needs none of the
// above, and nothing here has to infer what the artist meant.
//
// Run through the browser because that is the only PNG codec here. The pixels come out, the
// decision is made by the tested function in core, and the alpha goes back in.
//
//   npm run mark            write the masters under brand/
//   npm run mark -- --check fail if any is missing or stale

import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { flattenedBackground, maskedShare } from "../core/matte.ts";

// Three drawings, not one derived from the others. The lockup carries the name and goes
// where there is room to read it. The icon is the same mark without the name, for the tab,
// the launcher and the app's header, where a wordmark is a smudge at the size it is worn.
// The keys are that again without the tile, for setting on something already violet, where
// a violet tile has no edge to show and reads as a smudge behind the keys.
//
// Drawn separately on purpose. Cutting one out of another means repainting the ground where
// something was and sliding what is left back into place, and the tile's own highlight and
// the falling note's glow come along with it — a glow is made to blend into the ground
// behind it, so with the ground gone it stops being a glow and becomes a blob with an edge.
const SOURCES = [
    { source: "brand/source/plinky-mark.png", out: "brand/plinky-mark.png", what: "the lockup" },
    { source: "brand/source/plinky-icon.png", out: "brand/plinky-icon.png", what: "the icon" },
    { source: "brand/source/plinky-keys.png", out: "brand/plinky-keys.png", what: "the keys" },
    { source: "brand/source/plinky-tile.png", out: "brand/plinky-tile.png", what: "the tile" },
];
// The keyed masters are emitted at the largest size anything is rendered from — the brand
// kit's 1024 icon. Keeping them at the sources' own 1254 would commit a third more bytes
// that nothing ever reads at that size, and the sources are here for anyone who wants them.
const MASTER = 1024;
// The corner wedges come to about a sixteenth of a flattened picture. Far outside this and
// the artwork has changed shape — a full-bleed export, or a different mark — which is
// something to look at rather than to ship.
const EXPECTED = { min: 0.02, max: 0.2 };

const check = process.argv.includes("--check");
const browser = await chromium.launch();
const page = await browser.newPage();

let stale = false;
for (const { source, out, what } of SOURCES) {
    const bytes = await readFile(source);
    await page.setContent(
        `<img id="mark" src="data:image/png;base64,${bytes.toString("base64")}">`,
    );

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

    // Already transparent? Then it was drawn that way and there is nothing to find. A
    // transparent corner is the whole test: a flattened export has an opaque one by
    // definition, which is the problem this file exists for.
    const drawnWithAlpha = rgba[3] === 0;
    let mask = null;
    if (drawnWithAlpha) {
        console.log(`${source}: ${size.width}×${size.height}, already transparent`);
    } else {
        mask = flattenedBackground(rgba, size.width, size.height);
        const share = maskedShare(mask);
        console.log(
            `${source}: ${size.width}×${size.height}, background is ${(share * 100).toFixed(1)}% of it`,
        );
        if (share < EXPECTED.min || share > EXPECTED.max) {
            console.error(
                `That is outside the expected ${EXPECTED.min * 100}–${EXPECTED.max * 100}%. The artwork has changed shape; look at it before shipping.`,
            );
            await browser.close();
            process.exit(1);
        }
    }

    const keyed = await page.evaluate(
        async ({ flags, master }) => {
            const canvas = globalThis.__canvas;
            const context = canvas.getContext("2d");
            if (flags) {
                const image = context.getImageData(0, 0, canvas.width, canvas.height);
                const bits = Uint8Array.from(atob(flags), (one) => one.charCodeAt(0));
                for (let pixel = 0; pixel < bits.length; pixel++) {
                    if (bits[pixel] === 1) {
                        image.data[pixel * 4 + 3] = 0;
                    }
                }
                context.putImageData(image, 0, 0);
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
        { flags: mask ? Buffer.from(mask).toString("base64") : null, master: MASTER },
    );

    const png = Buffer.from(keyed, "base64");
    const existing = await readFile(out).catch(() => null);
    if (check) {
        if (!existing?.equals(png)) {
            console.error(`${out} is ${existing ? "stale" : "missing"}.`);
            stale = true;
        } else {
            console.log(`${out} is up to date.`);
        }
    } else {
        await writeFile(out, png);
        console.log(`Wrote ${out} (${(png.length / 1024).toFixed(0)} KB) — ${what}.`);
    }
}

if (stale) {
    console.error("Run `npm run mark` and commit the result.");
    await browser.close();
    process.exit(1);
}
await browser.close();
