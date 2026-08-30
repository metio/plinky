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
// Two shapes per piece, because a Short is not a small video. The Shorts grid on a channel
// page is portrait, and YouTube centre-crops a landscape thumbnail to fit it — which cuts
// exactly the corners this card sets its title and its wordmark in. So the portrait cut is
// its own card rather than the same one squeezed.
//
// Usage: npm run promo:thumbs [-- --out promo]
//
// Written beside that piece's clips in promo/<composer>/<piece>/: thumb.png for the
// landscape uploads, thumb-short.png for the Short.

import { mkdirSync, writeFileSync } from "node:fs";
import { readFile as read } from "node:fs/promises";
import { chromium } from "playwright";
import { folderFor, PIECES } from "./pieces.mjs";
import { DOMAIN, TITTLE as TITTLE_EM, tittleFromBoxBottom, WORDMARK } from "../../core/wordmark.ts";

const OUT = argValue("--out") ?? "promo";
const ONLY = argValue("--only");

function argValue(flag) {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
}

// The ground the clips are staged on. It was the logo's violet until the stage went black
// to stop it competing with the finger colours, and a thumbnail that does not match the
// video behind it reads as the wrong thumbnail. GLOW is a near-black violet rather than a
// second colour: enough that the card is not a dead rectangle, far too dark to be a hue.
const STAGE = "#000000";
const GLOW = "#180a2e";
const PAPER = "#f9f8fc";
const PLINK = "#aa36fc";
// The dot, anchored to the inline box's bottom — the end CSS gives us here. The numbers are
// core/wordmark's, the same ones the app header and an exported video's canvas draw from.
const TITTLE = `bottom:${tittleFromBoxBottom()}em;width:${TITTLE_EM.size}em;height:${TITTLE_EM.size}em`;

// The keys alone — no tile, no lockup. A tile would need an edge to read as a tile, and on
// this ground it has none, so it becomes a smudge behind the keys; the white keys carry
// their own edge against the dark. The card sets the name itself, which is why the lockup
// does not belong here either.
const keys = `data:image/png;base64,${(await read("brand/plinky-keys.png")).toString("base64")}`;

const fredoka = await read(
    "node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2",
);
const inter = await read(
    "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
);
const FACES = `@font-face{font-family:'Fredoka Variable';src:url(data:font/woff2;base64,${fredoka.toString("base64")}) format("woff2-variations");font-weight:300 700;font-display:block}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter.toString("base64")}) format("woff2-variations");font-weight:100 900;font-display:block}`;

// A long title has to shrink or it wraps into four lines and stops being readable small.
// The portrait card is narrower in pixels but gives a title far more height to wrap into,
// so it can afford to set the same words larger.
function titleSize(title, scale) {
    const base = title.length > 42 ? 62 : title.length > 26 ? 78 : 96;
    return Math.round(base * scale);
}

// The two cuts. Landscape fronts the full video; portrait fronts the Short, where the tile
// is taller than it is wide and the keys have room to sit under the title rather than
// beside it.
const CUTS = [
    {
        file: "thumb.png",
        width: 1280,
        height: 720,
        scale: 1,
        padding: "72px 88px",
        titleWidth: 820,
        keys: "right:36px;bottom:-40px;width:440px;height:440px",
    },
    {
        file: "thumb-short.png",
        width: 1080,
        height: 1920,
        scale: 1.5,
        padding: "150px 96px",
        titleWidth: 888,
        // Centred, large, and sitting in the middle of what the title and the wordmark
        // leave rather than on the floor — dropped to the bottom it opens a dead band
        // across the middle of the card, which is most of a portrait tile. A portrait tile
        // has width to spare, and the shape is what survives the shrink to a grid tile.
        keys: "left:50%;transform:translateX(-50%);bottom:400px;width:740px;height:740px",
    },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

function card(piece, cut) {
    return `<style>${FACES}html,body{margin:0;padding:0}*,*::before,*::after{box-sizing:border-box}</style>
         <div style="position:relative;overflow:hidden;width:${cut.width}px;height:${cut.height}px;background:radial-gradient(120% 140% at 18% 8%, ${GLOW} 0%, ${STAGE} 72%);display:flex;flex-direction:column;justify-content:space-between;padding:${cut.padding};font-family:'Fredoka Variable',Fredoka,ui-rounded,system-ui,sans-serif">
           <!-- The keys. A thumbnail is picked out of a grid of a dozen others at a fifth of
                this size, where a title is a grey smear and the only thing still legible is
                a shape and a colour — so the shape is the app's own, big enough to survive
                the shrink, and set where the longest title still clears it. -->
           <img src="${keys}" alt="" style="position:absolute;${cut.keys}">
           <div style="position:relative;max-width:${cut.titleWidth}px">
             <div style="font-size:${titleSize(piece.title, cut.scale)}px;font-weight:600;color:${PAPER};line-height:1.08;letter-spacing:-0.015em;text-wrap:balance">${piece.title}</div>
             <div style="font-family:Inter,system-ui,sans-serif;font-size:${Math.round(36 * cut.scale)}px;color:${PAPER};opacity:.72;margin-top:${Math.round(20 * cut.scale)}px">${piece.composer}</div>
           </div>
           <!-- One lockup, not two. Setting the wordmark and then "plinky.fun" beside it
                wrote the name twice on a card that has room to say it once — so the domain
                is the wordmark's own tail, in the same face, and the address and the name
                are the same object. -->
           <div style="position:relative;font-size:${Math.round(56 * cut.scale)}px;font-weight:600;letter-spacing:-0.01em;color:${PAPER};line-height:1">
             ${WORDMARK.before}<span style="position:relative">${WORDMARK.stem}<span style="position:absolute;left:50%;${TITTLE};transform:translateX(-50%);border-radius:999px;background:${PLINK}"></span></span>${WORDMARK.after}${DOMAIN}
           </div>
         </div>`;
}

let made = 0;
for (const cut of CUTS) {
    const page = await browser.newPage({
        viewport: { width: cut.width, height: cut.height },
    });
    for (const piece of PIECES) {
        if (ONLY && !piece.title.toLowerCase().includes(ONLY.toLowerCase())) {
            continue;
        }
        await page.setContent(card(piece, cut));
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(80);
        const dir = `${OUT}/${folderFor(piece)}`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/${cut.file}`, await page.screenshot());
        made += 1;
    }
    await page.close();
}

await browser.close();
console.log(
    `${made} thumbnails — 1280×720 and 1080×1920, two per piece, beside its clips in ${OUT}/.`,
);
