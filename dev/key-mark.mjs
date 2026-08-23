// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Gives the mark back its transparency.
//
// The artwork arrives flattened onto white — a rounded violet square with four white corner
// wedges and no alpha channel. Every icon rendered from it then carries those corners, and
// on any ground that is not white they show as a bright halo: the launcher on a dark phone,
// a tab strip in dark mode, a social card on a dark background.
//
// Cropping to a border-radius does not fix it. A radius is a guess at the artwork's own
// curve, and a guess even slightly tight leaves a sliver of the old background showing all
// the way round — the halo it was meant to remove. So the background is found rather than
// assumed: `core/matte.ts` floods inward from the corners across near-white, which is why
// the piano keys and the wordmark survive. They are white too, and enclosed.
//
// Run through the browser because that is the only PNG codec here. The pixels come out, the
// decision is made by the tested function in core, and the alpha goes back in.
//
//   npm run mark            write brand/plinky-mark.png and brand/plinky-icon.png
//   npm run mark -- --check fail if either is missing or stale

import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { flattenedBackground, maskedShare } from "../core/matte.ts";
import { wordlessMark } from "../core/iconMark.ts";

const SOURCE = "brand/source/plinky-mark.png";
const OUT = "brand/plinky-mark.png";
// The same mark with its wordmark taken out and the keys recentred. Two files because they
// are for two jobs: the lockup is read at poster and social-card size, where the name has
// room; the icon is worn at 32px in the header and on a launcher, where the name is a
// smudge and the keys need the space it was taking. See core/iconMark.ts.
const ICON_OUT = "brand/plinky-icon.png";
// The keyed master is emitted at the largest size anything is rendered from — the brand
// kit's 1024 icon. Keeping it at the source's own 1254 would commit a third more bytes that
// nothing ever reads at that size, and the source itself is here for anyone who wants them.
const MASTER = 1024;
// The mark's four corner wedges come to about a sixteenth of the picture. Far outside this
// and the artwork has changed shape — a full-bleed export, or a different mark — which is
// something to look at rather than to ship.
const EXPECTED = { min: 0.02, max: 0.2 };

const check = process.argv.includes("--check");
const browser = await chromium.launch();
const page = await browser.newPage();
const source = await readFile(SOURCE);
await page.setContent(`<img id="mark" src="data:image/png;base64,${source.toString("base64")}">`);

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

// Out as raw bytes rather than an array: a million pixels of JSON is minutes of serialising.
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

const mask = flattenedBackground(rgba, size.width, size.height);
const share = maskedShare(mask);
console.log(
    `${SOURCE}: ${size.width}×${size.height}, background is ${(share * 100).toFixed(1)}% of it`,
);
if (share < EXPECTED.min || share > EXPECTED.max) {
    console.error(
        `That is outside the expected ${EXPECTED.min * 100}–${EXPECTED.max * 100}%. The artwork has changed shape; look at it before shipping.`,
    );
    await browser.close();
    process.exit(1);
}

const keyed = await page.evaluate(async ({ flags, master }) => {
    const canvas = globalThis.__canvas;
    const context = canvas.getContext("2d");
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const bytes = Uint8Array.from(atob(flags), (one) => one.charCodeAt(0));
    for (let pixel = 0; pixel < bytes.length; pixel++) {
        if (bytes[pixel] === 1) {
            image.data[pixel * 4 + 3] = 0;
        }
    }
    context.putImageData(image, 0, 0);
    const out = document.createElement("canvas");
    out.width = master;
    out.height = Math.round((canvas.height / canvas.width) * master);
    const scaled = out.getContext("2d");
    scaled.imageSmoothingQuality = "high";
    // Scaled with the corners ALREADY transparent, so the edge blends toward nothing rather
    // than toward the white that was just removed — otherwise the halo comes back, softer.
    scaled.drawImage(canvas, 0, 0, out.width, out.height);
    return out.toDataURL("image/png").split(",")[1];
}, { flags: Buffer.from(mask).toString("base64"), master: MASTER });

const png = Buffer.from(keyed, "base64");

// The icon is derived from the KEYED master rather than from the source, so it inherits the
// silhouette the flood found instead of keying the same corners a second time.
const master = await pixelsOf(page, png);
const icon = wordlessMark(master.rgba, master.width, master.height);
const iconPng = Buffer.from(await pngOf(page, icon, master.width, master.height), "base64");

let stale = false;
for (const [path, bytes, what] of [
    [OUT, png, "with its corners transparent"],
    [ICON_OUT, iconPng, "with its wordmark removed and the keys centred"],
]) {
    const existing = await readFile(path).catch(() => null);
    if (check) {
        if (!existing || !existing.equals(bytes)) {
            console.error(`${path} is ${existing ? "stale" : "missing"}.`);
            stale = true;
        } else {
            console.log(`${path} is up to date.`);
        }
    } else {
        await writeFile(path, bytes);
        console.log(`Wrote ${path} (${(bytes.length / 1024).toFixed(0)} KB) ${what}.`);
    }
}
if (stale) {
    console.error("Run `npm run mark` and commit the result.");
    await browser.close();
    process.exit(1);
}
await browser.close();

// The browser is the only PNG codec here, so pixels cross the bridge as base64 rather than
// as a million-element array — which is minutes of serialising either way it goes.
async function pixelsOf(target, buffer) {
    return await target.evaluate(async (data) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        const raw = canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height).data;
        let binary = "";
        for (let at = 0; at < raw.length; at += 4096) {
            binary += String.fromCharCode.apply(null, raw.subarray(at, at + 4096));
        }
        return { width: canvas.width, height: canvas.height, base64: btoa(binary) };
    }, buffer.toString("base64")).then((out) => ({
        width: out.width,
        height: out.height,
        rgba: new Uint8ClampedArray(Buffer.from(out.base64, "base64")),
    }));
}

async function pngOf(target, rgba, width, height) {
    return await target.evaluate(
        ({ data, width, height }) => {
            const bytes = Uint8Array.from(atob(data), (one) => one.charCodeAt(0));
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            const image = context.createImageData(width, height);
            image.data.set(bytes);
            context.putImageData(image, 0, 0);
            return canvas.toDataURL("image/png").split(",")[1];
        },
        { data: Buffer.from(rgba.buffer).toString("base64"), width, height },
    );
}
