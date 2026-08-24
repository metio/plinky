// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds brand/ — the kit anybody making something *about* Plinky works from: the mark at
// every size, the mark on both grounds, the palette with each colour's role, a type
// specimen, and social images at the sizes the places we post want.
//
// Everything is derived. The colours are read out of app/app.css and the mark out of
// brand/plinky-mark.png, so a poster made from this kit cannot be in last month's palette:
// the kit is regenerated (`npm run brand`) and the values come from the app itself. Nothing
// here is hand-kept, which is the only way a brand kit stays true a year from now.
//
// The mark is a full lockup: the violet tile, the keys, the falling plink, and the name set
// in its own letterforms. Nothing here sets the word "Plinky" beside it — that would print
// the name twice — so the only type on these sheets is the tagline and the specimen.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const OUT = "brand";
const CSS = "app/app.css";
const MARK = "brand/plinky-mark.png";
// The same mark with its wordmark removed. A profile picture is cropped to a CIRCLE by
// every platform that asks for one, and it is read at 56px in a comment thread — two facts
// that rule the lockup out: the circle cuts through the name, and at that size the name is
// a smear over the keys it is stealing room from. See core/iconMark.ts.
const ICON = "brand/plinky-icon.png";

// The colours worth handing to somebody outside the codebase, with what each one MEANS —
// a hex without its role is how a brand ends up with red used for decoration.
const PALETTE = [
    ["paper", "--color-surface", "The page, and the paper a score is printed on."],
    ["ink", "--color-ink", "Type, staff lines, anything printed."],
    ["pencil", "--color-muted", "The teacher's annotation: hints, captions, asides."],
    ["rule", "--color-line", "Hairlines and dividers."],
    ["brass", "--color-spark", "Anything earned — stars, grades, the day's own thing."],
    ["violet", "--color-accent", "Anything you can press. Links, buttons, the cursor."],
    ["plink", "--color-plink", "The falling note in the mark. Nowhere else."],
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
function tokenValue(css, built, name) {
    const from = (text) => text.match(new RegExp(`${name}:\\s*([^;]+)`));
    const match = from(css) ?? from(built);
    if (!match) {
        throw new Error(`${name} is defined in neither ${CSS} nor the build`);
    }
    const raw = match[1].trim();
    return raw.startsWith("var(") ? tokenValue(css, built, raw.slice(4, -1).trim()) : raw;
}

const css = await readFile(CSS, "utf8");
// Carried into the page as a data URI rather than a file:// URL, so the render does not
// depend on where the browser thinks its document lives.
const mark = `data:image/png;base64,${(await readFile(MARK)).toString("base64")}`;
const icon = `data:image/png;base64,${(await readFile(ICON)).toString("base64")}`;
// The mark carries its own rounded silhouette in its alpha, so it is scaled and never
// clipped: a border-radius applied here is a guess at the artwork's own curve, and one
// slightly tight leaves a sliver of ground showing all the way round.
const tile = (size, style = "") =>
    `<img src="${mark}" alt="" style="width:${size}px;height:${size}px;flex:none;display:block;${style}">`;
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

// How far the artwork has to be scaled up for its own edges to fall outside the frame.
//
// A profile picture must carry NO ground. Any colour behind the tile shows as a ring the
// moment a platform crops it to a circle — ink showed as a dark one, and the tile's own
// violet sampled a few pixels in showed as a lighter one, because the artwork is drawn with
// a vignette and so has no single edge colour to match. There is nothing to match it to.
//
// So the artwork is bled past the frame instead and the background is left transparent.
// Every pixel inside the circle is then artwork, and the frame's corners — the only place
// transparency survives — are outside the circle every platform crops to.
//
// The factor is measured rather than fixed: the transparent margin is a property of the
// artwork, so a constant here would need revisiting every time the artwork is redrawn.
async function bleedOf(dataUrl) {
    const page = await browser.newPage();
    const scale = await page.evaluate(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const n = img.naturalWidth;
        const canvas = document.createElement("canvas");
        canvas.width = n;
        canvas.height = n;
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0);
        // Along the middle row, which crosses the tile's flat left and right sides rather
        // than its rounded corners: how far in before the artwork is solid?
        const row = context.getImageData(0, Math.round(n / 2), n, 1).data;
        let inset = 0;
        while (inset < n / 4 && row[inset * 4 + 3] < 250) inset++;
        // Scale so those insets land outside the frame, plus a pixel of slack for the
        // rounding either side.
        return (n + 2) / Math.max(1, n - 2 * (inset + 1));
    }, dataUrl);
    await page.close();
    return scale;
}

// A picture whose every visible pixel is artwork: bled past its frame, nothing behind it.
const bled = (art, size, scale) =>
    `<div style="width:${size}px;height:${size}px;overflow:hidden;display:flex;align-items:center;justify-content:center">
       <img src="${art}" alt="" style="width:${Math.round(size * scale)}px;height:${Math.round(size * scale)}px;flex:none;display:block">
     </div>`;

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

// The mark, at the sizes a store, a tab and a favourites bar ask for. Transparent outside
// its own silhouette, which is how it arrives.
for (const size of [1024, 512, 192, 180, 64, 32]) {
    await shoot(tile(size), {
        width: size,
        height: size,
        path: `${OUT}/icon/plinky-${size}.png`,
        transparent: true,
    });
}

// The mark on a ground it would otherwise vanish into. Its own tile is violet, so on a
// violet sheet it disappears; a paper plate behind it gives it its edge back. The radius
// is the plate's own, not a crop of the artwork.
const plated = (size) =>
    `<div style="background:${colour.paper};border-radius:26%;padding:${Math.round(size / 11)}px;flex:none">
       ${tile(size)}
     </div>`;

// The lockup: the mark beside the tagline, on paper and on violet. The mark already carries
// the name, so the type here says the one thing it does not.
const lockup = (ground, ink, badge) => `
<div style="width:960px;height:320px;background:${ground};display:flex;align-items:center;justify-content:center;gap:32px;padding:0 48px">
  ${badge}
  <div style="${DISPLAY};font-size:52px;letter-spacing:-0.01em;color:${ink};line-height:1.12">Practise piano in your browser</div>
</div>`;
await shoot(lockup(colour.paper, colour.ink, tile(180)), {
    width: 960,
    height: 320,
    path: `${OUT}/icon/lockup-paper.png`,
    scale: 2,
});
await shoot(lockup(colour.violet, colour.paper, plated(150)), {
    width: 960,
    height: 320,
    path: `${OUT}/icon/lockup-violet.png`,
    scale: 2,
});

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
       <div style="font-size:15px;color:${colour.pencil};margin:8px 0 32px">Every colour is named for its role. The violet carries anything you can press; the grading colours are spoken for and never decorate.</div>
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
       <div style="font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${colour.brass}">Display — Fredoka</div>
       <div style="${DISPLAY};font-size:72px;letter-spacing:-0.015em;margin:12px 0 8px">Practise piano in your browser</div>
       <div style="${DISPLAY};font-size:40px;color:${colour.ink}">Tuesday morning</div>
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
<div style="width:${width}px;height:${height}px;background:${colour.violet};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(height / 16)}px;text-align:center;padding:${Math.round(width / 12)}px">
  ${plated(Math.round(height / 4.4))}
  <div style="${DISPLAY};font-size:${titleSize}px;color:${colour.paper};line-height:1.1;letter-spacing:-0.01em">Practise piano in your browser</div>
  <div style="${UI};font-size:${Math.round(titleSize / 2.6)}px;color:${colour.paper};opacity:.82">Free · no account · nothing to install</div>
</div>`;
await shoot(social(1200, 630, 62), {
    width: 1200,
    height: 630,
    path: `${OUT}/social/open-graph-1200x630.png`,
});
await shoot(social(1080, 1080, 74), {
    width: 1080,
    height: 1080,
    path: `${OUT}/social/square-1080.png`,
});
await shoot(social(1080, 1920, 86), {
    width: 1080,
    height: 1920,
    path: `${OUT}/social/story-1080x1920.png`,
});
// Instagram's tallest feed size. A square post is cropped from this without losing
// anything; the reverse is not true, so a portrait is the one worth making.
await shoot(social(1080, 1350, 78), {
    width: 1080,
    height: 1350,
    path: `${OUT}/social/instagram-portrait-1080x1350.png`,
});

// The profile picture. Every platform crops one to a circle — Reddit, Facebook, Instagram,
// YouTube — so this is a full-bleed square of ground with the mark well inside the
// inscribed circle, and the crop is left to them.
//
// Drawing the circle here instead put white in the corners (a screenshot paints white
// where nothing is drawn) and YouTube's crop is a hair wider than the circle, so the
// corners showed as pale arcs along the top. A square has no edge to reveal.
//
// The profile picture, from the WORDLESS icon: every platform crops this one to a circle,
// which cuts straight through a wordmark set under the keys, and shows it at about 56px
// beside a comment, where that word is a smear. The keys and the falling note are centred,
// so a circle takes only the tile's corners — nothing that carries meaning.
//
// No ground behind it, and the artwork bled past the frame — see bleedOf above for why a
// ground of any colour cannot work here.
//
// 800 is what YouTube asks for; 512 covers Facebook and Instagram; 256 is Reddit's.
const iconBleed = await bleedOf(icon);
for (const size of [256, 512, 800]) {
    await shoot(bled(icon, size, iconBleed), {
        width: size,
        height: size,
        path: `${OUT}/social/profile-square-${size}.png`,
        transparent: true,
    });
}

// A YouTube channel banner. YouTube crops one image four ways — a TV shows the whole
// 2048×1152, a desktop a wide strip, a phone the middle — so everything that must survive
// sits in the 1235×338 box at the centre that every device shows, and the rest is ground.
// That box is a sixth of the picture: a banner designed edge to edge loses its ends on
// three devices out of four.
await shoot(
    `<div style="width:2048px;height:1152px;background:${colour.violet};display:flex;align-items:center;justify-content:center">
       <div style="width:1235px;height:338px;display:flex;align-items:center;justify-content:center;gap:40px;text-align:left">
         ${plated(240)}
         <div>
           <div style="${DISPLAY};font-size:58px;color:${colour.paper};line-height:1.12;letter-spacing:-0.01em">Practise piano in your browser</div>
           <div style="${UI};font-size:26px;color:${colour.paper};opacity:.75;margin-top:14px">Free · no account · nothing to install</div>
         </div>
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
    `<div style="width:1640px;height:624px;background:${colour.violet};display:flex;align-items:center;justify-content:center;gap:48px;padding:0 18%">
       ${plated(300)}
       <div style="${DISPLAY};font-size:64px;color:${colour.paper};line-height:1.12;letter-spacing:-0.01em">Practise piano in your browser</div>
     </div>`,
    { width: 1640, height: 624, path: `${OUT}/social/facebook-cover-1640x624.png` },
);

// The banner strip. Reddit lays the community icon and name over the left of it on a wide
// screen, so nothing goes there — the mark and the tagline sit right of that, where no
// overlay reaches and no crop takes them.
const banner = (width) => `
<div style="width:${width}px;height:128px;background:${colour.violet};display:flex;align-items:center;justify-content:flex-start;gap:20px;padding-left:${Math.round(width * 0.3)}px">
  ${plated(84)}
  <div>
    <div style="${DISPLAY};font-size:34px;letter-spacing:-0.01em;color:${colour.paper};line-height:1.1">Practise piano in your browser</div>
    <div style="${UI};font-size:18px;color:${colour.paper};opacity:.8;line-height:1.3;margin-top:4px">Free · no account · nothing to install</div>
  </div>
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

// The watermark YouTube overlays on a playing video. Transparent, so it is the mark and
// nothing else.
await shoot(tile(150), {
    width: 150,
    height: 150,
    path: `${OUT}/social/youtube-watermark-150.png`,
    transparent: true,
});

// A repository's social preview — what GitHub, Slack and a chat client unfurl for a link
// to the code. 1280×640 is what GitHub asks for, and it is shown large and never cropped
// to a circle, so this is the one place the name belongs INSIDE the picture: the tile can
// carry it without competing with type set beside it.
//
// The ground is ink, which the mark's own violet tile stands clear of. Unlike the profile
// picture this one is never cropped to a circle, so the tile keeps its silhouette and the
// ground has an edge to give it. The tagline sits beside it saying what the name does not.
//
// Everything stays inside the middle three quarters: an unfurl is re-cropped by whoever is
// doing the unfurling, and a preview designed edge to edge loses its ends.
await shoot(
    `<div style="width:1280px;height:640px;background:${colour.ink};display:flex;align-items:center;justify-content:center;gap:56px;padding:0 120px;box-sizing:border-box">
       <img src="${mark}" alt="" style="width:340px;height:340px;flex:none;display:block">
       <div style="${DISPLAY};font-size:64px;letter-spacing:-0.01em;color:${colour.paper};line-height:1.1">Practise piano in your browser</div>
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

console.log(`brand/ rebuilt from ${CSS} and ${MARK}`);
