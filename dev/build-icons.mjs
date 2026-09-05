// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders every icon the app ships from brand/plinky-mark.png — the launcher icons, the
// favicon, the README banner and the social card. Run `npm run icons` after changing the
// mark, which itself comes out of `npm run mark` (dev/key-mark.mjs keys the background off
// the artwork we are given and writes the master).
//
// These used to be made by hand, which meant the sources and the images beside them could
// disagree and nothing would say so. One source, one command.
//
// The mark is a full lockup: the tile, the keys, the falling plink, and the name set in
// its own letterforms. Nothing here sets the word "Plinky" beside it — that would print
// the name twice — so the only type on this page is the tagline.

import { readFile, unlink, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { tokenValue } from "./brandTokens.mjs";

// Two forms of one mark, each used where it can be read. The lockup carries the name and
// goes on the banner and the social card, which have room for it. The icon is the same
// artwork with the name taken out and the keys recentred, and goes wherever the mark is
// worn small — the tab, the launcher, the header — where the name would be a smudge and
// the keys need the space it was taking. Both come from `npm run mark`.
const MARK = "brand/plinky-mark.png";
const ICON = "brand/plinky-icon.png";
// The keys with no tile under them, for setting on something already violet.
const KEYS = "brand/plinky-keys.png";
// The palette is the app's, read off its tokens: the banner and the social card paint
// on the same paper, in the same ink, as the brand kit and the pages themselves.
const css = await readFile("app/app.css", "utf8");
const PAPER = tokenValue(css, "", "--color-surface");
const INK = tokenValue(css, "", "--color-ink");
const ACCENT = tokenValue(css, "", "--color-accent-solid");

// Carried into the page as a data URI rather than a file:// URL, so the render does not
// depend on where the browser thinks its document lives.
const mark = `data:image/png;base64,${(await readFile(MARK)).toString("base64")}`;
const icon = `data:image/png;base64,${(await readFile(ICON)).toString("base64")}`;
const keys = `data:image/png;base64,${(await readFile(KEYS)).toString("base64")}`;
// The tagline is set in the app's own display face, so the render has to carry the font
// with it — a headless browser has no Fredoka installed, and the fallback would not be
// the face the app ships. Latin only: nothing rendered here is ever translated.
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
         img{display:block;width:100%;height:100%}</style>${html}`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    const png = await page.screenshot({ omitBackground: true });
    await writeFile(path, png);
    await page.close();
    return png;
}

// The launcher sizes, from the wordless icon. 180 is Apple's touch icon, 192 and 512 are
// the manifest's. It carries its own rounded silhouette in its alpha, so it is scaled and
// never clipped: a radius applied here is a guess at the artwork's own curve, and one
// slightly tight leaves a sliver of ground showing all the way round.
const tile = (size) => `<img src="${icon}" alt="" width="${size}" height="${size}">`;
for (const size of [512, 192, 180, 32]) {
    await shoot(tile(size), { width: size, height: size, path: `public/icon-${size}.png` });
}

// The maskable form, which is a different picture rather than the same one re-cropped.
//
// A launcher that masks does not letterbox: it crops the icon to its own shape — a circle
// on some Android launchers, a squircle on others — and paints its own ground behind
// whatever is transparent. The tiles above carry their rounded silhouette in their alpha,
// which is right where nothing masks them and wrong where something does: installed through
// Chrome, the transparent corners came back as white and the tile floated in the middle of a
// white circle with ground showing on all four sides.
//
// So the violet reaches every edge here, and the artwork is the keys WITHOUT their tile —
// a tile on a ground of its own colour has no edge to show and would only read as a smudge.
// At 0.76 the keys sit inside the circle a mask may cut to, which is the guarantee the
// format asks for: everything outside the middle 80% is the platform's to take.
const MASK_SAFE = 0.76;
const maskable = (size) =>
    `<div style="width:${size}px;height:${size}px;background:${ACCENT};display:flex;align-items:center;justify-content:center">
       <img src="${keys}" alt="" style="width:${Math.round(size * MASK_SAFE)}px;height:${Math.round(size * MASK_SAFE)}px;flex:none">
     </div>`;
for (const size of [512, 192]) {
    await shoot(maskable(size), {
        width: size,
        height: size,
        path: `public/icon-maskable-${size}.png`,
    });
}

// The favicon: an ICO wrapping the 32px render. The format allows a PNG payload outright,
// so there is no bitmap to encode — a six-byte directory, a sixteen-byte entry, the image.
const png32 = await readFile("public/icon-32.png");
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

// The README banner: the lockup on paper, with room around it so it does not sit tight
// against whatever follows it in the file.
await shoot(
    `<div style="width:512px;height:160px;background:${PAPER};display:flex;align-items:center;justify-content:center;gap:22px;padding:0 28px">
       <img src="${mark}" alt="" style="width:120px;height:120px;flex:none">
       <div style="${DISPLAY};font-size:34px;color:${INK};line-height:1.15;letter-spacing:-0.01em">Practise piano in your browser</div>
     </div>`,
    { width: 512, height: 160, path: "public/icon-banner-512.png" },
);

// The social card every link to Plinky unfurls as. It is made here, from the same mark as
// the launcher icons, because it was made by hand once and then sat two identities out of
// date while every gate stayed green.
const siteUrl = (await readFile("core/site.ts", "utf8")).match(/SITE_URL\s*=\s*"([^"]+)"/)?.[1];
if (!siteUrl) {
    throw new Error("could not find SITE_URL in core/site.ts");
}
await shoot(
    `<div style="width:1200px;height:630px;background:${ACCENT};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;text-align:center;padding:64px">
       <img src="${mark}" alt="" style="width:300px;height:300px;flex:none">
       <div style="${DISPLAY};font-size:58px;color:${PAPER};line-height:1.15;letter-spacing:-0.01em">Practise piano in your browser</div>
       <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:26px;color:${PAPER};opacity:.8">${new URL(siteUrl).host} · free, no account, nothing to install</div>
     </div>`,
    { width: 1200, height: 630, path: "public/og.png" },
);

await browser.close();

// The 32px render only existed to become the ICO; drop it so the directory holds exactly
// what the app references.
await unlink("public/icon-32.png");

console.log(
    "public/: icon-512, icon-192, icon-180 and favicon.ico from brand/plinky-icon.png; " +
        "icon-maskable-512 and icon-maskable-192 from brand/plinky-keys.png on the accent; " +
        "icon-banner-512 and og.png from brand/plinky-mark.png",
);
