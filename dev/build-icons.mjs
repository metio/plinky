// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders every icon the app ships from public/icon.svg — the launcher icons, the favicon
// and the README banner. Run `npm run icons` after changing the mark.
//
// These used to be made by hand, which meant the SVG and the images beside it could
// disagree and nothing would say so. One source, one command.

import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const ICON = "public/icon.svg";
// The tab's own mark: the letter alone, with no tile behind it.
const TAB = "public/favicon.svg";
const PAPER = "#fcf7ea";
const INK = "#241c14";

const icon = await readFile(ICON, "utf8");
const tab = await readFile(TAB, "utf8");
// The banner sets the wordmark in the app's own display face, so it has to carry the font
// with it — a headless browser has no Literata installed, and the fallback serif is not
// the face the app ships.
const literata = await readFile(
    "node_modules/@fontsource-variable/literata/files/literata-latin-wght-normal.woff2",
);
const FACE = `@font-face{font-family:"Literata Variable";src:url(data:font/woff2;base64,${literata.toString("base64")}) format("woff2-variations");font-weight:200 900;font-display:block}`;

const browser = await chromium.launch();

async function shoot(html, { width, height, path }) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(
        `<style>${FACE}html,body{margin:0;padding:0}*,*::before,*::after{box-sizing:border-box}
         svg{display:block;width:100%;height:100%}</style>${html}`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    const png = await page.screenshot({ omitBackground: true });
    await writeFile(path, png);
    await page.close();
    return png;
}

// The launcher sizes. 180 is Apple's touch icon, 192 and 512 are the manifest's.
const renders = new Map();
for (const size of [512, 192, 180, 64, 32]) {
    renders.set(
        size,
        await shoot(`<div style="width:${size}px;height:${size}px">${icon}</div>`, {
            width: size,
            height: size,
            path: `public/icon-${size}.png`,
        }),
    );
}

// The favicon: an ICO wrapping a 32px render of the tab mark. The format allows a PNG
// payload outright, so there is no bitmap to encode — a six-byte directory, a sixteen-byte
// entry, the image. It carries the light-tab colour, since an ICO cannot answer the
// browser's theme the way the SVG beside it does.
const png32 = await shoot(`<div style="width:32px;height:32px">${tab}</div>`, {
    width: 32,
    height: 32,
    path: "public/favicon-32.png",
});
const ico = Buffer.alloc(22 + png32.length);
ico.writeUInt16LE(0, 0); // reserved
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // one image
ico.writeUInt8(32, 6); // width
ico.writeUInt8(32, 7); // height
ico.writeUInt8(0, 8); // palette: none
ico.writeUInt8(0, 9); // reserved
ico.writeUInt16LE(1, 10); // colour planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(png32.length, 14);
ico.writeUInt32LE(22, 18); // offset of the image data
png32.copy(ico, 22);
await writeFile("public/favicon.ico", ico);

// The README banner: the mark beside the wordmark, with the pink dot the wordmark always
// carries on its i.
await shoot(
    `<div style="width:512px;height:160px;background:${PAPER};display:flex;align-items:center;justify-content:center;gap:20px">
       <div style="width:96px;height:96px;border-radius:22%;overflow:hidden">${icon}</div>
       <div style="font-family:'Literata Variable',Literata,Georgia,serif;font-variation-settings:'wght' 600;font-size:76px;font-weight:600;letter-spacing:-0.01em;color:${INK};line-height:1">
         Pl<span style="position:relative">ı<span style="position:absolute;left:50%;top:.17em;width:.15em;height:.15em;transform:translateX(-50%);border-radius:999px;background:#d81b7a"></span></span>nky
       </div>
     </div>`,
    { width: 512, height: 160, path: "public/icon-banner-512.png" },
);

await browser.close();

// The sizes that only existed to be rendered here are not shipped; drop them so the
// directory holds exactly what the app references.
const { unlink } = await import("node:fs/promises");
for (const path of ["public/icon-64.png", "public/icon-32.png", "public/favicon-32.png"]) {
    await unlink(path);
}

console.log("public/: icon-512, icon-192, icon-180, icon-banner-512 from icon.svg; favicon.ico from favicon.svg");
