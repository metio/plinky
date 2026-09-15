// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders every icon the app ships from the vector mark in brand/mark — the launcher icons,
// Apple's touch icon, the maskable icons, the favicon, the README banner and the social
// card. Run `npm run icons` after `npm run mark` changes the mark.
//
// These used to be made by hand, which meant the sources and the images beside them could
// disagree and nothing would say so. One source, one command.

import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { markGroup, markImage } from "./brandGroup.mjs";
import { tokenValue } from "./brandTokens.mjs";

// Carried into the page as data URIs rather than file:// URLs, so the render does not depend
// on where the browser thinks its document lives.
const mark = async (name) =>
    `data:image/svg+xml;base64,${(await readFile(`brand/mark/${name}`)).toString("base64")}`;
// The rounded tile, for anything that shows an icon as it is: a tab, a launcher that does
// not mask, a bookmark.
const TILE = await mark("tile.svg");
// Full bleed, for anything that rounds the corners itself.
const SQUARE = await mark("square.svg");
// Full bleed with the drawing inside the safe zone, for launchers that crop to a shape.
const MASKABLE = await mark("maskable.svg");
// The lockup and the social card's parts, with their own proportions, so a height is all a
// layout has to choose.
const LOCKUP_LIGHT = markImage(await readFile("brand/mark/lockup-light.svg"));
const FRAMED_TILE = markImage(await readFile("brand/mark/tile-framed.svg"));
const NAME_WHITE = markImage(await readFile("brand/mark/name-white.svg"));

// The palette is the app's, read off its tokens: the banner and the social card paint on the
// same paper, in the same ink, as the brand kit and the pages themselves.
const css = await readFile("app/app.css", "utf8");
const PAPER = tokenValue(css, "", "--color-surface");
const INK = tokenValue(css, "", "--color-ink");
const ACCENT = tokenValue(css, "", "--color-accent-solid");

// The tagline is set in the app's own display face, so the render has to carry the font
// with it — a headless browser has no Fredoka installed, and the fallback would not be the
// face the app ships. Latin only: nothing rendered here is ever translated.
const fredoka = await readFile(
    "node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2",
);
const FACE = `@font-face{font-family:"Fredoka Variable";src:url(data:font/woff2;base64,${fredoka.toString("base64")}) format("woff2-variations");font-weight:300 700;font-display:block}`;
const DISPLAY = `font-family:'Fredoka Variable',Fredoka,ui-rounded,system-ui,sans-serif;font-variation-settings:'wght' 600`;

const browser = await chromium.launch();

async function shoot(html, { width, height, path }) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(
        `<style>${FACE}html,body{margin:0;padding:0}*,*::before,*::after{box-sizing:border-box}
         img{display:block}</style>${html}`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    const png = await page.screenshot({ omitBackground: true });
    if (path) {
        await writeFile(path, png);
    }
    await page.close();
    return png;
}

const picture = (src, size) =>
    `<img src="${src}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;

// The manifest's icons, from the tile. It carries its rounded silhouette in its alpha, which
// is right wherever nothing masks it.
for (const size of [512, 192]) {
    await shoot(picture(TILE, size), {
        width: size,
        height: size,
        path: `public/icon-${size}.png`,
    });
}

// Apple's touch icon, from the full-bleed square. iOS rounds the corners itself and paints
// black into anything transparent, so the tile's own transparent corners would come back as
// dark wedges.
await shoot(picture(SQUARE, 180), { width: 180, height: 180, path: "public/icon-180.png" });

// The maskable form. A launcher that masks does not letterbox: it crops the icon to its own
// shape — a circle on some Android launchers, a squircle on others — and paints its own
// ground behind whatever is transparent. So the ground reaches every edge here and the
// drawing sits inside the middle 80%, which is the part the format promises to leave alone.
for (const size of [512, 192]) {
    await shoot(picture(MASKABLE, size), {
        width: size,
        height: size,
        path: `public/icon-maskable-${size}.png`,
    });
}

// The favicon: an ICO holding the tile at 16, 32 and 48, so a browser picks the size it
// draws at rather than scaling one down. The format allows PNG payloads outright, so there
// is no bitmap to encode — a six-byte directory, sixteen bytes per entry, then the images.
const FAVICON_SIZES = [16, 32, 48];
const images = [];
for (const size of FAVICON_SIZES) {
    images.push(await shoot(picture(TILE, size), { width: size, height: size }));
}
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((png, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(FAVICON_SIZES[index], entry); // width
    header.writeUInt8(FAVICON_SIZES[index], entry + 1); // height
    header.writeUInt8(0, entry + 2); // palette: none
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
});
await writeFile("public/favicon.ico", Buffer.concat([header, ...images]));

// The README banner: the lockup on paper beside the tagline, with room around it so it does
// not sit tight against whatever follows it in the file.
await shoot(
    `<div style="width:512px;height:160px;background:${PAPER};display:flex;align-items:center;justify-content:center;gap:24px;padding:0 24px">
       <img src="${LOCKUP_LIGHT.src}" alt="" style="height:64px;width:${Math.round(64 * LOCKUP_LIGHT.aspect)}px;flex:none">
       <div style="${DISPLAY};font-size:28px;color:${INK};line-height:1.15">Practise piano in your browser</div>
     </div>`,
    { width: 512, height: 160, path: "public/icon-banner-512.png" },
);

// The social card every link to Plinky unfurls as. It is made here, from the same mark as
// the launcher icons, because it was made by hand once and then sat two identities out of
// date while every gate stayed green. It sets the same group as the brand kit's open-graph
// image, with the address in its small line.
const siteUrl = (await readFile("core/site.ts", "utf8")).match(/SITE_URL\s*=\s*"([^"]+)"/)?.[1];
if (!siteUrl) {
    throw new Error("could not find SITE_URL in core/site.ts");
}
await shoot(
    `<div style="width:1200px;height:630px;background:${ACCENT};display:flex;align-items:center;justify-content:center;padding:64px">
       ${markGroup({
           tile: FRAMED_TILE,
           name: NAME_WHITE,
           size: 300,
           wide: true,
           measure: 560,
           ink: PAPER,
           display: DISPLAY,
           ui: "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
           tagline: "Practise piano in your browser",
           line: `${new URL(siteUrl).host} · free, no account, nothing to install`,
       })}
     </div>`,
    { width: 1200, height: 630, path: "public/og.png" },
);

await browser.close();

console.log(
    "public/: icon-512, icon-192 and favicon.ico (16, 32, 48) from brand/mark/tile.svg; " +
        "icon-180 from square.svg; icon-maskable-512 and -192 from maskable.svg; " +
        "icon-banner-512 from lockup-light.svg; og.png from tile-framed.svg and name-white.svg",
);
