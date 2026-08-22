// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds brand/ — the kit anybody making something *about* Plinky works from: the icon at
// every size, the wordmark on both grounds, the palette with each colour's role, a type
// specimen, and social images at the sizes the places we post want.
//
// Everything is derived. The colours are read out of app/app.css and the mark out of
// public/icon.svg, so a poster made from this kit cannot be in last month's palette: the
// kit is regenerated (`npm run brand`) and the values come from the app itself. Nothing
// here is hand-kept, which is the only way a brand kit stays true a year from now.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const OUT = "brand";
const CSS = "app/app.css";
const ICON = "public/icon.svg";

// The colours worth handing to somebody outside the codebase, with what each one MEANS —
// a hex without its role is how a brand ends up with red used for decoration.
const PALETTE = [
    ["paper", "--color-surface", "The page, and the paper a score is printed on."],
    ["ink", "--color-ink", "Type, staff lines, anything printed."],
    ["pencil", "--color-muted", "The teacher's annotation: hints, captions, asides."],
    ["rule", "--color-line", "Hairlines and dividers."],
    ["brass", "--color-spark", "Anything earned — stars, grades, the day's own thing."],
    ["ink blue", "--color-accent", "Anything you can press. Links, buttons, the cursor."],
    ["plink", "--color-plink", "The dot on the i, and the note in the icon. Nowhere else."],
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
function valueOf(css, built, name) {
    const from = (text) => text.match(new RegExp(`${name}:\\s*([^;]+)`));
    const match = from(css) ?? from(built);
    if (!match) {
        throw new Error(`${name} is defined in neither ${CSS} nor the build`);
    }
    const raw = match[1].trim();
    return raw.startsWith("var(") ? valueOf(css, built, raw.slice(4, -1).trim()) : raw;
}

const css = await readFile(CSS, "utf8");
// The file carries width="192" height="192" so it renders standalone; inside a lockup it
// has to take the size of the box it is given, or it overflows and lands on the wordmark.
// The letter alone, as the browser tab wears it. Its own stylesheet paints it ink blue on
// a light page, which is the wrong colour over a video, so the fill is replaced outright.
const letterOnly = (await readFile("public/favicon.svg", "utf8"))
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replace(/class="letter"/g, 'fill="currentColor"')
    .replace("<svg ", '<svg style="width:100%;height:100%;display:block" ');
const icon = (await readFile(ICON, "utf8"))
    .replace(/ width="\d+"/, "")
    .replace(/ height="\d+"/, "")
    .replace("<svg ", '<svg style="width:100%;height:100%;display:block" ');
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
    [...PALETTE, ...SPOKEN_FOR].map(([name, token]) => [name, valueOf(css, built, token)]),
);

await mkdir(`${OUT}/icon`, { recursive: true });
await mkdir(`${OUT}/social`, { recursive: true });

// The sheets set the app's own faces, so they have to carry them: a headless browser has
// none installed, and a fallback serif is not the identity these files exist to record.
// It also moves the metrics the wordmark's dot is positioned against.
const literata = await readFile(
    "node_modules/@fontsource-variable/literata/files/literata-latin-wght-normal.woff2",
);
const inter = await readFile("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const FACES = `@font-face{font-family:Literata;src:url(data:font/woff2;base64,${literata.toString("base64")}) format("woff2-variations");font-weight:200 900;font-display:block}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter.toString("base64")}) format("woff2-variations");font-weight:100 900;font-display:block}`;

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
    // how the profile picture ended up with white corners under a circular crop.
    await writeFile(path, await page.screenshot({ fullPage: full, omitBackground: transparent }));
    await page.close();
}

// The mark, at the sizes a store, a tab and a favourites bar ask for.
for (const size of [1024, 512, 192, 180, 64, 32]) {
    await shoot(`<div style="width:${size}px;height:${size}px">${icon}</div>`, {
        width: size,
        height: size,
        path: `${OUT}/icon/plinky-${size}.png`,
    });
}
await writeFile(`${OUT}/icon/plinky.svg`, icon);

// The pink dot, anchored to the text baseline rather than to the top of the box it sits
// in. Literata puts its tittle's underside .545em above the baseline, and the box an
// absolutely positioned child is measured against reaches .3em below it — both measured
// here, the first by rasterising a real i at this weight, the second by reading the box
// off the DOM — so .845em from the bottom lands the dot where the glyph would.
//
// Anchoring from the top instead needs a different number at every size, because the
// box's top moves with the line height; that is why the app header carries its own value
// and why its comment says to measure again rather than carry the number here. Below
// about 24px the gap over the x-height is under two device pixels and rounding decides
// it, so this rule is for display sizes.
const TITTLE = "bottom:.845em;width:.1525em;height:.1525em";

// The mark on a ground it would otherwise vanish into. Its own tile is ink blue, so on an
// ink-blue sheet it disappears and leaves a bare P standing next to the P the wordmark
// starts with. A paper surround gives it its edge back.
const framed = (size) =>
    `<div style="background:${colour.paper};border-radius:26%;padding:${Math.round(size / 11)}px">
       <div style="width:${size}px;height:${size}px;border-radius:22%;overflow:hidden">${icon}</div>
     </div>`;

// The lockup: mark plus wordmark, on paper and on ink blue.
const lockup = (ground, ink, mark) => `
<div style="width:960px;height:320px;background:${ground};display:flex;align-items:center;justify-content:center;gap:28px">
  ${mark}
  <div style="font-family:Literata,Georgia,serif;font-size:104px;font-weight:600;letter-spacing:-0.01em;color:${ink};line-height:1">
    Pl<span style="position:relative">ı<span style="position:absolute;left:50%;${TITTLE};transform:translateX(-50%);border-radius:999px;background:${colour.plink}"></span></span>nky
  </div>
</div>`;
await shoot(
    lockup(
        colour.paper,
        colour.ink,
        `<div style="width:132px;height:132px;border-radius:22%;overflow:hidden">${icon}</div>`,
    ),
    {
    width: 960,
    height: 320,
        path: `${OUT}/icon/lockup-paper.png`,
        scale: 2,
    },
);
await shoot(lockup(colour["ink blue"], colour.paper, framed(132)), {
    width: 960,
    height: 320,
    path: `${OUT}/icon/lockup-ink-blue.png`,
    scale: 2,
});

// The palette, as a sheet somebody can hold next to a design.
const swatch = ([name, , why]) => `
  <div style="display:flex;flex-direction:column">
    <div style="height:96px;background:${colour[name]};border:1px solid ${colour.rule}"></div>
    <div style="padding:10px 2px 0;font-family:Inter,system-ui,sans-serif">
      <div style="font-size:15px;font-weight:600;color:${colour.ink}">${name}</div>
      <div style="font-size:13px;font-family:ui-monospace,Menlo,monospace;color:${colour.pencil}">${colour[name]}</div>
      <div style="font-size:13px;line-height:1.45;color:${colour.pencil};margin-top:4px">${why}</div>
    </div>
  </div>`;
await shoot(
    `<div style="width:1200px;background:${colour.paper};padding:48px;font-family:Inter,system-ui,sans-serif">
       <div style="font-family:Literata,Georgia,serif;font-size:40px;font-weight:600;color:${colour.ink}">Plinky — the palette</div>
       <div style="font-size:15px;color:${colour.pencil};margin:8px 0 32px">Every colour is named for its role. Warmth comes from the ground and the type; the accent stays cool so it never argues with the grading.</div>
       <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px">${PALETTE.map(swatch).join("")}</div>
       <div style="font-family:Literata,Georgia,serif;font-size:26px;font-weight:600;color:${colour.ink};margin:44px 0 6px">Spoken for</div>
       <div style="font-size:15px;color:${colour.pencil};margin-bottom:24px">These three carry meaning on the one screen where colour is information. Never borrow them for decoration.</div>
       <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px">${SPOKEN_FOR.map(swatch).join("")}</div>
     </div>`,
    { width: 1200, height: 640, path: `${OUT}/palette.png`, scale: 2, full: true },
);

// The type, set the way the app sets it.
await shoot(
    `<div style="width:1200px;height:700px;background:${colour.paper};padding:56px;font-family:Inter,system-ui,sans-serif;color:${colour.ink}">
       <div style="font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${colour.brass}">Display — Literata</div>
       <div style="font-family:Literata,Georgia,serif;font-size:72px;font-weight:600;letter-spacing:-0.015em;margin:12px 0 8px">Practise piano in your browser</div>
       <div style="font-family:Literata,Georgia,serif;font-size:40px;font-weight:600;color:${colour.ink}">Tuesday morning</div>
       <div style="height:1px;background:${colour.rule};margin:40px 0"></div>
       <div style="font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${colour.brass}">Interface — Inter</div>
       <div style="font-size:19px;margin:12px 0 6px">Play it as slowly as you like — the notes wait for you.</div>
       <div style="font-size:15px;color:${colour.pencil}">Grade 3 · skill 214 · nine pieces on the stand</div>
       <div style="font-size:15px;font-variant-numeric:tabular-nums;margin-top:16px">♩ = 72 · bar 17 · 94%</div>
     </div>`,
    { width: 1200, height: 700, path: `${OUT}/type.png`, scale: 2 },
);

// The places we post, at the sizes they want.
const social = (width, height, titleSize) => `
<div style="width:${width}px;height:${height}px;background:${colour["ink blue"]};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(height / 16)}px;text-align:center;padding:${Math.round(width / 12)}px;box-sizing:border-box">
  ${framed(Math.round(height / 4))}
  <div style="font-family:Literata,Georgia,serif;font-size:${titleSize}px;font-weight:600;color:${colour.paper};line-height:1.1;letter-spacing:-0.01em">Practise piano in your browser</div>
  <div style="font-family:Inter,system-ui,sans-serif;font-size:${Math.round(titleSize / 2.6)}px;color:${colour.paper};opacity:.82">Free · no account · nothing to install</div>
</div>`;
await shoot(social(1200, 630, 62), { width: 1200, height: 630, path: `${OUT}/social/open-graph-1200x630.png` });
await shoot(social(1080, 1080, 74), { width: 1080, height: 1080, path: `${OUT}/social/square-1080.png` });
await shoot(social(1080, 1920, 86), { width: 1080, height: 1920, path: `${OUT}/social/story-1080x1920.png` });
// Instagram's tallest feed size. A square post is cropped from this without losing
// anything; the reverse is not true, so a portrait is the one worth making.
await shoot(social(1080, 1350, 78), { width: 1080, height: 1350, path: `${OUT}/social/instagram-portrait-1080x1350.png` });

// The profile picture. Every platform crops one to a circle — Reddit, Facebook, Instagram,
// YouTube — so this is a full-bleed square of ground with the letter well inside the
// inscribed circle, and the crop is left to them.
//
// Drawing the circle here instead put white in the corners (a screenshot paints white
// where nothing is drawn) and YouTube's crop is a hair wider than the circle, so the
// corners showed as pale arcs along the top. A square has no edge to reveal.
//
// The letter is placed by its centre of GRAVITY, not its bounding box. A capital P carries
// its mass in the stem and the bowl and leaves a void at the lower right, so a box-centred
// P reads as sitting high and left — measured on the 800px render, its ink sat 1.5% left
// and 4.2% above the middle. Nudging it back by that much is what makes it look centred,
// which is the only kind of centred anybody sees.
const OPTICAL_X = 0.015;
const OPTICAL_Y = 0.042;
// 800 is what YouTube asks for; 512 covers Facebook and Instagram; 256 is Reddit's.
for (const size of [256, 512, 800]) {
    const letter = Math.round(size * 0.67);
    await shoot(
        `<div style="width:${size}px;height:${size}px;background:${colour["ink blue"]};display:flex;align-items:center;justify-content:center;overflow:hidden">
           <div style="width:${letter}px;height:${letter}px;transform:translate(${(size * OPTICAL_X).toFixed(1)}px, ${(size * OPTICAL_Y).toFixed(1)}px)">${icon}</div>
         </div>`,
        { width: size, height: size, path: `${OUT}/social/profile-square-${size}.png` },
    );
}

// A YouTube channel banner. YouTube crops one image four ways — a TV shows the whole
// 2048×1152, a desktop a wide strip, a phone the middle — so everything that must survive
// sits in the 1235×338 box at the centre that every device shows, and the rest is ground.
// That box is a sixth of the picture: a banner designed edge to edge loses its ends on
// three devices out of four.
await shoot(
    `<div style="width:2048px;height:1152px;background:${colour["ink blue"]};display:flex;align-items:center;justify-content:center">
       <div style="width:1235px;height:338px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center">
         <div style="font-family:Literata,Georgia,serif;font-size:128px;font-weight:600;letter-spacing:-0.015em;color:${colour.paper};line-height:1">
           Pl<span style="position:relative">ı<span style="position:absolute;left:50%;${TITTLE};transform:translateX(-50%);border-radius:999px;background:${colour.plink}"></span></span>nky
         </div>
         <div style="font-family:Literata,Georgia,serif;font-size:46px;font-weight:600;color:${colour.paper};line-height:1.15;letter-spacing:-0.01em">Practise piano in your browser</div>
         <div style="font-family:Inter,system-ui,sans-serif;font-size:24px;color:${colour.paper};opacity:.75">Free · no account · nothing to install</div>
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
    `<div style="width:1640px;height:624px;background:${colour["ink blue"]};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center;padding:0 24%">
       <div style="font-family:Literata,Georgia,serif;font-size:132px;font-weight:600;letter-spacing:-0.015em;color:${colour.paper};line-height:1">
         Pl<span style="position:relative">ı<span style="position:absolute;left:50%;${TITTLE};transform:translateX(-50%);border-radius:999px;background:${colour.plink}"></span></span>nky
       </div>
       <div style="font-family:Literata,Georgia,serif;font-size:52px;font-weight:600;color:${colour.paper};line-height:1.15;letter-spacing:-0.01em">Practise piano in your browser</div>
     </div>`,
    { width: 1640, height: 624, path: `${OUT}/social/facebook-cover-1640x624.png` },
);

// The banner strip. Reddit lays the community icon and name over the left of it on a
// wide screen, so nothing goes there — the mark and the wordmark sit right of that,
// where no overlay reaches and no crop takes them.
// No mark on it: the community icon is already the P, and it sits over the left of the
// banner on a wide screen. The wordmark carries the strip on its own.
const banner = (width) => `
<div style="width:${width}px;height:128px;background:${colour["ink blue"]};display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;padding-left:${Math.round(width * 0.3)}px;box-sizing:border-box">
  <div style="font-family:Literata,Georgia,serif;font-size:50px;font-weight:600;letter-spacing:-0.01em;color:${colour.paper};line-height:1">
    Pl<span style="position:relative">ı<span style="position:absolute;left:50%;${TITTLE};transform:translateX(-50%);border-radius:999px;background:${colour.plink}"></span></span>nky
  </div>
  <div style="font-family:Inter,system-ui,sans-serif;font-size:20px;color:${colour.paper};opacity:.8;line-height:1.3">Practise piano in your browser</div>
</div>`;
await shoot(banner(1072), { width: 1072, height: 128, path: `${OUT}/social/reddit-banner-desktop-1072x128.png` });
await shoot(banner(1080), { width: 1080, height: 128, path: `${OUT}/social/reddit-banner-mobile-1080x128.png` });

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

console.log(`brand/ rebuilt from ${CSS} and ${ICON}`);
