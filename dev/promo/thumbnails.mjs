// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A thumbnail per video, each naming its own piece.
//
// YouTube takes a thumbnail per video, not per channel, and a generic one on every upload
// makes a channel read as a wall of identical tiles — the one thing a thumbnail exists to
// prevent. So each is the piece and its composer, set large enough to survive being shown
// at a fifth of this size in a list of a dozen others, over the app's own ground.
//
// The pieces come from the same list the clips are rendered from, so a thumbnail can never
// be of a different piece than the video it sits on.
//
// Usage: npm run promo:thumbs [-- --out promo-thumbs]

import { mkdirSync, writeFileSync } from "node:fs";
import { readFile as read } from "node:fs/promises";
import { chromium } from "playwright";
import { fileNameFor, PIECES } from "./pieces.mjs";

const OUT = argValue("--out") ?? "promo-thumbs";
const ONLY = argValue("--only");

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

const INK_BLUE = "#2b4374";
const PAPER = "#fcf7ea";
const PLINK = "#d81b7a";
// Measured against a real i at this weight; see dev/build-icons.mjs.
const TITTLE = "bottom:.845em;width:.1525em;height:.1525em";

const literata = await read(
    "node_modules/@fontsource-variable/literata/files/literata-latin-wght-normal.woff2",
);
const inter = await read("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const FACES = `@font-face{font-family:Literata;src:url(data:font/woff2;base64,${literata.toString("base64")}) format("woff2-variations");font-weight:200 900;font-display:block}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter.toString("base64")}) format("woff2-variations");font-weight:100 900;font-display:block}`;

// A long title has to shrink or it wraps into four lines and stops being readable small.
function titleSize(title) {
    if (title.length > 42) {
        return 62;
    }
    return title.length > 26 ? 78 : 96;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

let made = 0;
for (const piece of PIECES) {
    if (ONLY && !piece.title.toLowerCase().includes(ONLY.toLowerCase())) {
        continue;
    }
    await page.setContent(
        `<style>${FACES}html,body{margin:0;padding:0}*,*::before,*::after{box-sizing:border-box}</style>
         <div style="width:1280px;height:720px;background:${INK_BLUE};display:flex;flex-direction:column;justify-content:space-between;padding:72px 88px;font-family:Literata,Georgia,serif">
           <div>
             <div style="font-size:${titleSize(piece.title)}px;font-weight:600;color:${PAPER};line-height:1.08;letter-spacing:-0.015em;text-wrap:balance">${piece.title}</div>
             <div style="font-family:Inter,system-ui,sans-serif;font-size:36px;color:${PAPER};opacity:.72;margin-top:20px">${piece.composer}</div>
           </div>
           <div style="display:flex;align-items:baseline;gap:20px">
             <div style="font-size:56px;font-weight:600;letter-spacing:-0.01em;color:${PAPER};line-height:1">
               Pl<span style="position:relative">ı<span style="position:absolute;left:50%;${TITTLE};transform:translateX(-50%);border-radius:999px;background:${PLINK}"></span></span>nky
             </div>
             <div style="font-family:Inter,system-ui,sans-serif;font-size:26px;color:${PAPER};opacity:.6">plinky.fun</div>
           </div>
         </div>`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(80);
    const file = `${OUT}/${fileNameFor(piece)}.png`;
    writeFileSync(file, await page.screenshot());
    made += 1;
}

await browser.close();
console.log(`${made} thumbnails in ${OUT}/ — 1280×720, one per clip, named to match.`);
