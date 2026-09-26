// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders every icon the app ships from the keyed artwork in brand/ — the launcher icons,
// Apple's touch icon, the maskable icons, the favicon, the README banner and the social
// card. Run `npm run icons` after `npm run logo` rewrites the artwork.
//
// These used to be made by hand, which meant the sources and the images beside them could
// disagree and nothing would say so. One source, one command.

import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { framedMark, markGroup, markImage, picture } from "./brandGroup.mjs";
import { tokenValue } from "./brandTokens.mjs";

// Three drawings, each carried into the page as a data URI rather than a file:// URL, so the
// render does not depend on where the browser thinks its document lives.
//
// The lockup carries the name in its own artwork and goes where there is room to read it.
// The icon is the same picture without the name, for the tab and the launcher, where a
// wordmark is a smudge at the size it is worn. The keys are that again without the tile, for
// setting on a ground the tile would have no edge against.
const png = async (path) => markImage(await readFile(path), "image/png");
const LOCKUP = await png("brand/plinky-mark.png");
const ICON = await png("brand/plinky-icon.png");
const KEYS = await png("brand/plinky-keys.png");
// The outlined name, which the social card sets beside the framed icon (`npm run mark`).
const NAME_WHITE = markImage(await readFile("brand/name-white.svg"));

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

// A square of accent with the keys inside it, filling the given share of the frame. No
// transparency anywhere, so nothing can paint its own colour into a corner — and the keys
// rather than the tile, because a tile on a ground of nearly its own colour has no edge to
// show and reads as a smudge.
const filled = (size, share) =>
    `<div style="width:${size}px;height:${size}px;background:${ACCENT};display:flex;align-items:center;justify-content:center">
       ${picture(KEYS, Math.round(size * share))}
     </div>`;

// The manifest's icons, from the wordless icon. It carries its rounded silhouette in its
// alpha, which is right wherever nothing masks it, and it is never clipped: a radius applied
// here is a guess at the artwork's own curve, and one slightly tight leaves a sliver of
// ground showing all the way round.
for (const size of [512, 192]) {
    await shoot(picture(ICON, size), {
        width: size,
        height: size,
        path: `public/icon-${size}.png`,
    });
}

// Apple's touch icon, full bleed. iOS rounds the corners itself and paints black into
// anything transparent, so the tile's own transparent corners would come back as dark
// wedges.
await shoot(filled(180, 0.86), { width: 180, height: 180, path: "public/icon-180.png" });

// The maskable form. A launcher that masks does not letterbox: it crops the icon to its own
// shape — a circle on some Android launchers, a squircle on others — and paints its own
// ground behind whatever is transparent. So the ground reaches every edge here and the
// drawing sits inside the middle 80%, which is the part the format promises to leave alone.
for (const size of [512, 192]) {
    await shoot(filled(size, 0.76), {
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
    images.push(await shoot(picture(ICON, size), { width: size, height: size }));
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
// not sit tight against whatever follows it in the file. The lockup carries the name itself,
// so the only type here is the one thing it does not say.
await shoot(
    `<div style="width:512px;height:160px;background:${PAPER};display:flex;align-items:center;justify-content:center;gap:22px;padding:0 28px">
       ${picture(LOCKUP, 120)}
       <div style="${DISPLAY};font-size:32px;color:${INK};line-height:1.15">Practise piano in your browser</div>
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
           mark: framedMark(ICON, PAPER),
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
    "public/: icon-512, icon-192 and favicon.ico (16, 32, 48) from brand/plinky-icon.png; " +
        "icon-180 and the maskables from brand/plinky-keys.png on the accent; " +
        "icon-banner-512 from brand/plinky-mark.png; og.png from the framed icon and " +
        "brand/name-white.svg",
);
