// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds brand/ — the kit anybody making something *about* Plinky works from: the mark at
// every size, the lockups on both grounds, the palette with each colour's role, a type
// specimen, and social images at the sizes the places we post want.
//
// Everything is derived. The colours are read out of app/app.css and the mark out of the
// vector files in brand/mark (npm run mark), so a poster made from this kit cannot be in
// last month's palette: the kit is regenerated (`npm run brand`) and the values come from
// the app itself. Nothing here is hand-kept, which is the only way a brand kit stays true a
// year from now.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { markGroup, markImage } from "./brandGroup.mjs";
import { tokenValue } from "./brandTokens.mjs";

const OUT = "brand";
const CSS = "app/app.css";

// The colours worth handing to somebody outside the codebase, with what each one MEANS —
// a hex without its role is how a brand ends up with red used for decoration.
const PALETTE = [
    ["paper", "--color-surface", "The page, and the paper a score is printed on."],
    ["ink", "--color-ink", "Type, staff lines, anything printed."],
    ["pencil", "--color-muted", "The teacher's annotation: hints, captions, asides."],
    ["rule", "--color-line", "Hairlines and dividers."],
    ["indigo", "--color-accent", "Anything you can press. Links, buttons, the cursor."],
    [
        "forget-me-not",
        "--color-spark",
        "Anything earned — grades, section marks, the day's own thing.",
    ],
    [
        "name",
        "--color-brand-ink",
        "The name beside the mark on a light ground. White on a dark one.",
    ],
    [
        "plink",
        "--color-plink",
        "The falling note: the loader, and a petal of the header's bouquet.",
    ],
];

// Colours that carry meaning inside the app and must never be borrowed for decoration.
const SPOKEN_FOR = [
    ["found", "--color-success", "The note you played correctly."],
    ["missed", "--color-danger", "The note you did not."],
    ["caution", "--color-warn", "A warning, and the S grade."],
];

// A token's light-theme value. app.css is the source; the three meaning-carrying colours
// resolve to Tailwind's own palette, which only exists once the stylesheet is built — so
// those are read out of the build, where they are already resolved.
const css = await readFile(CSS, "utf8");
// The built stylesheet, for the palette values Tailwind resolves. Any build will do —
// these are theme constants, not per-page output.
const assets = await readdir("build/client/assets").catch(() => []);
const builtName = assets.find((name) => name.endsWith(".css"));
if (!builtName) {
    console.error("No built stylesheet. Run `npm run build:single` first.");
    process.exit(1);
}
const built = await readFile(`build/client/assets/${builtName}`, "utf8");
const colour = Object.fromEntries(
    [...PALETTE, ...SPOKEN_FOR].map(([name, token]) => [name, tokenValue(css, built, token)]),
);

// The mark, carried into each page as a data URI rather than a file:// URL, so the render
// does not depend on where the browser thinks its document lives.
const MARK = {};
for (const name of [
    "tile",
    "tile-framed",
    "square",
    "badge",
    "lockup-light",
    "lockup-indigo",
    "name-white",
]) {
    MARK[name] = markImage(await readFile(`brand/mark/${name}.svg`));
}
// One form of the mark at a given height; the width follows from its own proportions.
const img = (name, height) =>
    `<img src="${MARK[name].src}" alt="" style="height:${height}px;width:${Math.round(height * MARK[name].aspect)}px;flex:none;display:block">`;

await mkdir(`${OUT}/icon`, { recursive: true });
await mkdir(`${OUT}/social`, { recursive: true });

// The sheets set the app's own faces, so they have to carry them: a headless browser has
// none installed, and a fallback sans is not the identity these files exist to record.
// Fredoka is Latin only here — the app pairs it with Comfortaa for Greek and Cyrillic, and
// nothing rendered by this script is ever translated.
const fredoka = await readFile(
    "node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2",
);
const inter = await readFile(
    "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
);
const FACES = `@font-face{font-family:"Fredoka Variable";src:url(data:font/woff2;base64,${fredoka.toString("base64")}) format("woff2-variations");font-weight:300 700;font-display:block}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter.toString("base64")}) format("woff2-variations");font-weight:100 900;font-display:block}`;
const DISPLAY =
    "font-family:'Fredoka Variable',Fredoka,ui-rounded,system-ui,sans-serif;font-weight:600";
const UI = "font-family:Inter,system-ui,sans-serif";

const browser = await chromium.launch();

async function shoot(html, { width, height, path, scale = 1, full = false, transparent = false }) {
    const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: scale,
    });
    // border-box everywhere: a sheet that sets its own padding must still be exactly as
    // wide as the shot, or the last column is cropped off the edge.
    await page.setContent(
        `<style>${FACES}html,body{margin:0;padding:0}*,*::before,*::after{box-sizing:border-box}</style>${html}`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    // Without omitBackground a screenshot paints white wherever nothing is drawn, which is
    // how the profile picture once ended up with white corners under a circular crop.
    await writeFile(path, await page.screenshot({ fullPage: full, omitBackground: transparent }));
    await page.close();
}

// The app icon, at the sizes a store, a tab and a favourites bar ask for. Transparent
// outside the tile's own rounded silhouette, which is how it arrives.
for (const size of [1024, 512, 192, 180, 64, 32]) {
    await shoot(img("tile", size), {
        width: size,
        height: size,
        path: `${OUT}/icon/plinky-${size}.png`,
        transparent: true,
    });
}

// The name inside the circle, for places that show the mark without a caption.
await shoot(img("badge", 512), {
    width: 512,
    height: 512,
    path: `${OUT}/icon/badge-512.png`,
    transparent: true,
});

// The lockup above the tagline, on paper and on indigo. On indigo the tile stands in its
// white frame and the name opens up a little. The frame adds an eleventh of the tile on each
// side, so the framed lockup is set that much taller to keep the tile itself the same size.
const lockupSheet = (ground, ink, form, height) => `
<div style="width:960px;height:320px;background:${ground};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px">
  ${img(form, height)}
  <div style="${DISPLAY};font-size:40px;color:${ink};line-height:1.12">Practise piano in your browser</div>
</div>`;
await shoot(lockupSheet(colour.paper, colour.ink, "lockup-light", 112), {
    width: 960,
    height: 320,
    path: `${OUT}/icon/lockup-paper.png`,
    scale: 2,
});
await shoot(
    lockupSheet(colour.indigo, colour.paper, "lockup-indigo", Math.round((112 * 13) / 11)),
    {
        width: 960,
        height: 320,
        path: `${OUT}/icon/lockup-indigo.png`,
        scale: 2,
    },
);

// The palette, as a sheet somebody can hold next to a design.
const swatch = ([name, , why]) => `
  <div style="display:flex;flex-direction:column">
    <div style="height:96px;background:${colour[name]};border:1px solid ${colour.rule}"></div>
    <div style="padding:10px 2px 0;${UI}">
      <div style="font-size:15px;font-weight:600;color:${colour.ink}">${name}</div>
      <div style="font-size:13px;font-family:ui-monospace,Menlo,monospace;color:${colour.pencil}">${colour[name]}</div>
      <div style="font-size:13px;line-height:1.45;color:${colour.pencil};margin-top:4px">${why}</div>
    </div>
  </div>`;
await shoot(
    `<div style="width:1200px;background:${colour.paper};padding:48px;${UI}">
       <div style="${DISPLAY};font-size:40px;color:${colour.ink}">Plinky — the palette</div>
       <div style="font-size:15px;color:${colour.pencil};margin:8px 0 32px">Every colour is named for its role. The indigo carries anything you can press; the grading colours are spoken for and never decorate.</div>
       <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px">${PALETTE.map(swatch).join("")}</div>
       <div style="${DISPLAY};font-size:26px;color:${colour.ink};margin:44px 0 6px">Spoken for</div>
       <div style="font-size:15px;color:${colour.pencil};margin-bottom:24px">These three carry meaning on the one screen where colour is information. Never borrow them for decoration.</div>
       <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px">${SPOKEN_FOR.map(swatch).join("")}</div>
     </div>`,
    { width: 1200, height: 640, path: `${OUT}/palette.png`, scale: 2, full: true },
);

// The type, set the way the app sets it.
await shoot(
    `<div style="width:1200px;height:700px;background:${colour.paper};padding:56px;${UI};color:${colour.ink}">
       <div style="font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${colour["forget-me-not"]}">Display — Fredoka</div>
       <div style="${DISPLAY};font-size:72px;letter-spacing:-0.015em;margin:12px 0 8px">Practise piano in your browser</div>
       <div style="${DISPLAY};font-size:40px;color:${colour.ink}">Tuesday morning</div>
       <div style="height:1px;background:${colour.rule};margin:40px 0"></div>
       <div style="font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${colour["forget-me-not"]}">Interface — Inter</div>
       <div style="font-size:19px;margin:12px 0 6px">Play it as slowly as you like — the notes wait for you.</div>
       <div style="font-size:15px;color:${colour.pencil}">Grade 3 · skill 214 · nine pieces on the stand</div>
       <div style="font-size:15px;font-variant-numeric:tabular-nums;margin-top:16px">♩ = 72 · bar 17 · 94%</div>
     </div>`,
    { width: 1200, height: 700, path: `${OUT}/type.png`, scale: 2 },
);

// The places we post, at the sizes they want. On indigo the tile stands in its white frame,
// which gives it the edge a tile of nearly the ground's own colour does not have, and it is
// set large: the mark is the first thing a picture shows, the name the second. A wide
// picture sets the words beside the tile, a square or tall one under it.
const group = (size, options) =>
    markGroup({
        tile: MARK["tile-framed"],
        name: MARK["name-white"],
        size,
        ink: colour.paper,
        display: DISPLAY,
        ui: UI,
        tagline: "Practise piano in your browser",
        line: "Free · no account · nothing to install",
        ...options,
    });
const social = (width, height, size, options = {}) => `
<div style="width:${width}px;height:${height}px;background:${colour.indigo};display:flex;align-items:center;justify-content:center;padding:${Math.round(width / 12)}px">
  ${group(size, { wide: width / height > 1.3, ...options })}
</div>`;
await shoot(social(1200, 630, 300, { measure: 440 }), {
    width: 1200,
    height: 630,
    path: `${OUT}/social/open-graph-1200x630.png`,
});
await shoot(social(1080, 1080, 330), {
    width: 1080,
    height: 1080,
    path: `${OUT}/social/square-1080.png`,
});
await shoot(social(1080, 1920, 440), {
    width: 1080,
    height: 1920,
    path: `${OUT}/social/story-1080x1920.png`,
});
// Instagram's tallest feed size. A square post is cropped from this without losing
// anything; the reverse is not true, so a portrait is the one worth making.
await shoot(social(1080, 1350, 380), {
    width: 1080,
    height: 1350,
    path: `${OUT}/social/instagram-portrait-1080x1350.png`,
});

// The profile picture: the symbol alone, the designer's own recommendation for an avatar.
// Every platform crops one to a circle — Reddit, Facebook, Instagram, YouTube — and shows
// it at about 56px beside a comment, where a name would be a smear.
//
// It is the full-bleed square rather than the circle. Drawing the circle here would leave
// its corners transparent or white, and YouTube's crop is a hair wider than the circle, so
// those corners showed as pale arcs along the top. Inside any circular crop the square is
// exactly the symbol, and past its edge there is only the same indigo ground to reveal.
//
// 800 is what YouTube asks for; 512 covers Facebook and Instagram; 256 is Reddit's.
for (const size of [256, 512, 800]) {
    await shoot(img("square", size), {
        width: size,
        height: size,
        path: `${OUT}/social/profile-square-${size}.png`,
    });
}

// A YouTube channel banner. YouTube crops one image four ways — a TV shows the whole
// 2048×1152, a desktop a wide strip, a phone the middle — so everything that must survive
// sits in the 1235×338 box at the centre that every device shows, and the rest is ground.
// That box is a sixth of the picture: a banner designed edge to edge loses its ends on
// three devices out of four.
await shoot(
    `<div style="width:2048px;height:1152px;background:${colour.indigo};display:flex;align-items:center;justify-content:center">
       <div style="width:1235px;height:338px;display:flex;align-items:center;justify-content:center">
         ${group(284, { wide: true })}
       </div>
     </div>`,
    { width: 2048, height: 1152, path: `${OUT}/social/youtube-banner-2048x1152.png` },
);

// A Facebook page cover. Facebook shows it at 820×312 on a desktop and crops it to a
// taller, narrower window on a phone, and it lays the page's own name and buttons over the
// bottom left — so everything that matters sits in the middle, and the edges carry nothing
// but ground. Rendered at twice the size it is shown, which is what keeps it crisp on the
// screens people actually have.
await shoot(
    `<div style="width:1640px;height:624px;background:${colour.indigo};display:flex;align-items:center;justify-content:center">
       ${group(280, { wide: true, measure: 408 })}
     </div>`,
    { width: 1640, height: 624, path: `${OUT}/social/facebook-cover-1640x624.png` },
);

// The banner strip. Reddit lays the community icon and name over the left of it on a wide
// screen, so nothing goes there — the group sits right of that, where no overlay reaches and
// no crop takes it, and as tall as the strip allows. At this height the derived type would
// be too small to read, so the tagline and its line are set at sizes of their own.
const banner = (width) => `
<div style="width:${width}px;height:128px;background:${colour.indigo};display:flex;align-items:center;justify-content:flex-start;padding-left:${Math.round(width * 0.3)}px">
  ${group(102, { wide: true, title: 26, small: 15 })}
</div>`;
await shoot(banner(1072), {
    width: 1072,
    height: 128,
    path: `${OUT}/social/reddit-banner-desktop-1072x128.png`,
});
await shoot(banner(1080), {
    width: 1080,
    height: 128,
    path: `${OUT}/social/reddit-banner-mobile-1080x128.png`,
});

// The watermark YouTube overlays on a playing video, over whatever the video shows.
// Transparent, so it is the framed tile and nothing else: the frame is its edge on a dark
// frame and on an indigo one alike.
await shoot(img("tile-framed", 150), {
    width: 150,
    height: 150,
    path: `${OUT}/social/youtube-watermark-150.png`,
    transparent: true,
});

// A repository's social preview — what GitHub, Slack and a chat client unfurl for a link
// to the code. 1280×640 is what GitHub asks for, and it is shown large and never cropped to
// a circle, so the name can be set at a size that reads.
//
// The ground is the designer's navy, the name's own ink: a code host's page is mostly dark
// chrome or white, and this one stands apart from the indigo every post wears. Everything
// stays inside the middle three quarters: an unfurl is re-cropped by whoever is doing the
// unfurling, and a preview designed edge to edge loses its ends.
await shoot(
    `<div style="width:1280px;height:640px;background:${colour.name};display:flex;align-items:center;justify-content:center;padding:0 120px">
       ${group(300, { wide: true, measure: 440 })}
     </div>`,
    { width: 1280, height: 640, path: `${OUT}/social/github-social-1280x640.png` },
);

await browser.close();

// The machine-readable copy, for whatever tool comes next.
await writeFile(
    `${OUT}/palette.json`,
    `${JSON.stringify(
        {
            note: "Generated by dev/build-brand.mjs from app/app.css. Do not edit; run `npm run brand`.",
            brand: Object.fromEntries(
                PALETTE.map(([name, token, why]) => [name, { hex: colour[name], token, why }]),
            ),
            spokenFor: Object.fromEntries(
                SPOKEN_FOR.map(([name, token, why]) => [name, { hex: colour[name], token, why }]),
            ),
        },
        null,
        4,
    )}\n`,
);

console.log(`brand/ rebuilt from ${CSS} and brand/mark`);
