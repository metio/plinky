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
// Usage: npm run promo:thumbs [-- --out promo]
//
// One thumbnail per piece, written beside that piece's clips in promo/<composer>/<piece>/.

import { mkdirSync, writeFileSync } from "node:fs";
import { readFile as read } from "node:fs/promises";
import { chromium } from "playwright";
import { folderFor, PIECES } from "./pieces.mjs";

const OUT = argValue("--out") ?? "promo";
const ONLY = argValue("--only");

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

const INK = "#191545";
const PAPER = "#f9f8fc";
const PLINK = "#aa36fc";
const VIOLET = "#4915d2";
// Fredoka puts its tittle 0.55em above the baseline at a diameter of 0.16em, centred on the
// stem; the inline box drops 0.22em below the baseline, so anchoring from its bottom is
// 0.55 + 0.22 = 0.77em. See dev/build-icons.mjs.
const TITTLE = "bottom:.77em;width:.16em;height:.16em";

// The mark, wordless: the thumbnail sets the name itself, so the lockup would print it
// twice. It fills the right of the frame, where a title never reaches.
const mark = `data:image/png;base64,${(await read("brand/plinky-icon.png")).toString("base64")}`;

const fredoka = await read(
    "node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2",
);
const inter = await read("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const FACES = `@font-face{font-family:'Fredoka Variable';src:url(data:font/woff2;base64,${fredoka.toString("base64")}) format("woff2-variations");font-weight:300 700;font-display:block}
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
         <div style="position:relative;overflow:hidden;width:1280px;height:720px;background:radial-gradient(120% 140% at 18% 8%, ${VIOLET} 0%, ${INK} 78%);display:flex;flex-direction:column;justify-content:space-between;padding:72px 88px;font-family:'Fredoka Variable',Fredoka,ui-rounded,system-ui,sans-serif">
           <!-- The mark, bled off the bottom-right corner. A thumbnail is picked out of a
                grid of a dozen others at a fifth of this size, where a title is a grey smear
                and the only thing still legible is a shape and a colour — so the shape is
                the app's own, big enough to survive the shrink, and set where the longest
                title still clears it. -->
           <img src="${mark}" alt="" style="position:absolute;right:-72px;bottom:-96px;width:520px;height:520px;opacity:.92">
           <div style="position:relative;max-width:820px">
             <div style="font-size:${titleSize(piece.title)}px;font-weight:600;color:${PAPER};line-height:1.08;letter-spacing:-0.015em;text-wrap:balance">${piece.title}</div>
             <div style="font-family:Inter,system-ui,sans-serif;font-size:36px;color:${PAPER};opacity:.72;margin-top:20px">${piece.composer}</div>
           </div>
           <div style="position:relative;display:flex;align-items:baseline;gap:20px">
             <div style="font-size:56px;font-weight:600;letter-spacing:-0.01em;color:${PAPER};line-height:1">
               Pl<span style="position:relative">ı<span style="position:absolute;left:50%;${TITTLE};transform:translateX(-50%);border-radius:999px;background:${PLINK}"></span></span>nky
             </div>
             <div style="font-family:Inter,system-ui,sans-serif;font-size:26px;color:${PAPER};opacity:.6">plinky.fun</div>
           </div>
         </div>`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(80);
    const dir = `${OUT}/${folderFor(piece)}`;
    mkdirSync(dir, { recursive: true });
    const file = `${dir}/thumb.png`;
    writeFileSync(file, await page.screenshot());
    made += 1;
}

await browser.close();
console.log(`${made} thumbnails — 1280×720, one per piece, beside its clips in ${OUT}/.`);
