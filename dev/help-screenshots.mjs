// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Takes the pictures the help page shows of each part of the app, straight from a real
// build. They were captured by hand before this existed, which is why they went on
// showing a navigation bar and a colour scheme the app had stopped having: nothing
// connected the pictures to the thing they were pictures of.
//
// Nothing here is committed. The deploy takes them: each language's build job in
// .github/workflows/website.yml shoots its own ten from the site it has just built and
// ships them in its artifact, so what reaches a reader is a picture of the build serving
// it. Two shapes, one script:
//
//   npm run help:shots -- --locales=de --out=build/client/help   # one language, in place
//   npm run build && npm run help:shots                          # all of them, locally
//
// The local form needs an ALL-LOCALES build, because that is the only tree that holds
// twenty-six languages to photograph; `--locales=` narrows it to the ones a single-locale
// build has. Either way the pictures land under <out>/<locale>/, which is what the help
// page asks for at /help/<locale>/<name>.webp.
//
// A picture is taken per locale, because help that describes a button by a name the
// screenshot beside it does not use has to be translated a second time by the person
// reading it. A reader fetches only their own set, so twenty-six of them cost a visitor
// exactly what one did.
//
// Every shot is of a fresh device — no progress, no imported scores, nothing dismissed —
// because that is the app a reader opening the help page is most likely looking at, and
// because a screenshot of somebody else's progress is a screenshot of a fiction.
//
// The webp encoding is done by the browser that took the shot (a canvas encodes it), so
// this needs no image library and no host binary: anywhere Playwright runs, this runs.

import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { chromium } from "playwright";
import { serveStatic } from "./staticServer.mjs";

const CLIENT = "build/client";
const DEFAULT_OUT = "public/help";
// The size the help page reserves for them (see app/routes/help.tsx), so a picture
// never arrives and pushes the page around.
const WIDTH = 1200;
const HEIGHT = 750;
// Below the quality webp starts smudging the notation, which is the one thing in these
// pictures a reader might actually try to read.
const QUALITY = 0.86;

// One bundled piece, so the play shot needs nothing from the network. Same id the
// accessibility sweep and Lighthouse audit use.
const PIECE = "47xd2XDpYFCy";

// Every section of the help page that carries a picture, and the page it is of.
const SHOTS = [
    ["home", ""],
    ["play", `play/${PIECE}/`],
    ["music", "music/"],
    ["daily", "daily/"],
    ["ear", "ear/"],
    ["compose", "compose/"],
    ["assignments", "assignments/"],
    ["stats", "stats/"],
    ["review", "review/"],
    ["settings", "settings/"],
];

// The languages to photograph: whatever has a message file, which is the same list
// `messages:check` holds every locale to. Reading it rather than restating it means a
// twenty-seventh language needs no edit here.
const LOCALES = readdirSync("messages")
    .filter((name) => name.endsWith(".json"))
    .map((name) => basename(name, ".json"))
    .sort();

// The built site as it is served: a prerendered document per path, everything else a
// file, and the SPA shell for anything that has neither.
function serve() {
    return serveStatic(CLIENT, { fallback: "spa", host: "127.0.0.1" });
}

// Which languages to take, and where to put them. `--locales=de,fr` takes a named few,
// which is both how the deploy takes one and how you check a change without driving two
// hundred and sixty page loads through a browser. `--out=` points them somewhere other
// than public/, which is what a build job shooting into its own tree needs.
const argv = process.argv.slice(2);
const only = argv.find((one) => one.startsWith("--locales="))?.slice("--locales=".length);
const OUT = argv.find((one) => one.startsWith("--out="))?.slice("--out=".length) ?? DEFAULT_OUT;
const asked = only ? only.split(",").filter(Boolean) : LOCALES;
const unknown = asked.filter((locale) => !LOCALES.includes(locale));
if (unknown.length > 0) {
    console.error(`Not a language Plinky speaks: ${unknown.join(", ")}`);
    process.exit(1);
}

// A language the build does not hold would be served the SPA shell — which photographs as
// an empty page rather than as a failure, so it is worth refusing outright. This is the
// one check that catches asking twenty-six languages of a build pinned to one, and asking
// for a language of a build pinned to another.
const missing = asked.filter((locale) => !existsSync(join(CLIENT, locale, "index.html")));
if (missing.length > 0) {
    console.error(
        `${CLIENT} has no pages for ${missing.join(", ")}. A pinned build ` +
            `(PLINKY_LOCALE=xx npm run build:client) holds one language; ` +
            `\`npm run build\` holds all ${LOCALES.length}.`,
    );
    process.exit(1);
}

console.log(`Taking ${asked.length * SHOTS.length} pictures: ${asked.join(", ")}`);

const { server, port } = await serve();
const browser = await chromium.launch();

let taken = 0;
for (const locale of asked) {
    const page = await browser.newPage({
        viewport: { width: WIDTH, height: HEIGHT },
        deviceScaleFactor: 1,
        colorScheme: "light",
        // The browser's own language is set to the one being photographed, so anything the
        // platform draws rather than the app — a date, a file picker, a number — matches the
        // page around it instead of quietly staying English.
        locale,
        // A picture of a moving thing is a picture of one frame of it. Everything the app
        // animates is decorative and drops out under this, which is what a still wants.
        reducedMotion: "reduce",
    });

    await mkdir(join(OUT, locale), { recursive: true });
    for (const [name, path] of SHOTS) {
        await page.goto(`http://127.0.0.1:${port}/${locale}/${path}`, { waitUntil: "networkidle" });
        // The parts that read local state render after mount, so the shot waits for the page
        // to have finished arriving rather than for the document to exist.
        await page.waitForSelector("main", { state: "visible" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        await page.evaluate(() => window.scrollTo(0, 0));
        const png = await page.screenshot({ type: "png" });

        // Chromium encodes the webp itself, from the shot it just took.
        const webp = await page.evaluate(
            async ({ dataUrl, quality }) => {
                const image = new Image();
                image.src = dataUrl;
                await image.decode();
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                canvas.getContext("2d").drawImage(image, 0, 0);
                return canvas.toDataURL("image/webp", quality);
            },
            { dataUrl: `data:image/png;base64,${png.toString("base64")}`, quality: QUALITY },
        );
        if (!webp.startsWith("data:image/webp")) {
            throw new Error(`${name}: the browser would not encode webp`);
        }
        const bytes = Buffer.from(webp.split(",")[1], "base64");
        await writeFile(join(OUT, locale, `${name}.webp`), bytes);
        taken += 1;
    }
    await page.close();
    console.log(`  ${locale}  ${SHOTS.length} pictures`);
}

await browser.close();
server.close();
console.log(`Took ${taken} help pictures at ${WIDTH}×${HEIGHT}, quality ${QUALITY}, into ${OUT}/.`);
