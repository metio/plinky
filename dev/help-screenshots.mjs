// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Takes the pictures the help page shows of each part of the app, straight from a real
// build. They were captured by hand before this existed, which is why they went on
// showing a navigation bar and a colour scheme the app had stopped having: nothing
// connected the pictures to the thing they were pictures of.
//
// Run it after an ALL-LOCALES build: `npm run build && npm run help:shots`. Not
// `build:single` — that tree-shakes to one language, which is right for what a visitor
// downloads and useless for photographing twenty-six of them.
//
// A picture is taken per locale, because help that describes a button by a name the
// screenshot beside it does not use has to be translated a second time by the person
// reading it. A reader fetches only their own set, so twenty-six of them cost a visitor
// exactly what one did; what grows is the repo, which is why nothing is re-shot unless
// something it is a picture OF has changed.
//
// Every shot is of a fresh device — no progress, no imported scores, nothing dismissed —
// because that is the app a reader opening the help page is most likely looking at, and
// because a screenshot of somebody else's progress is a screenshot of a fiction.
//
// The webp encoding is done by the browser that took the shot (a canvas encodes it), so
// this needs no image library and no host binary: anywhere Playwright runs, this runs.

import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { chromium } from "playwright";
import { serveStatic } from "./staticServer.mjs";

const CLIENT = "build/client";
const OUT = "public/help";
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

// What the pictures were taken of, so a run can tell what is worth taking again.
const LEDGER = "dev/help-shots.json";

// The languages to photograph: whatever has a message file, which is the same list
// `messages:check` holds every locale to. Reading it rather than restating it means a
// twenty-seventh language needs no edit here.
const LOCALES = readdirSync("messages")
    .filter((name) => name.endsWith(".json"))
    .map((name) => basename(name, ".json"))
    .sort();

// A locale's pictures are stale when its own words change, or when the app they are
// pictures of changes. The first is the message file; the second is the built asset
// names, which Vite derives from content — so any change to the app moves them and every
// locale is re-shot, while a reworded German string re-shoots German alone.
// The catalogue is in the pictures too — the music list shows its titles and its count —
// and it is served as a file rather than bundled, so no asset name moves when it changes.
// Hashing it here is what stops a re-import leaving all 260 pictures quietly out of date.
const CATALOGUE = join(CLIENT, "songs", "manifest.json");
const appFingerprint = createHash("sha256")
    .update(readdirSync(join(CLIENT, "assets")).sort().join("\n"))
    .update(existsSync(CATALOGUE) ? await readFile(CATALOGUE) : "")
    .digest("hex")
    .slice(0, 16);

async function localeFingerprint(locale) {
    const words = await readFile(join("messages", `${locale}.json`), "utf8");
    return createHash("sha256").update(`${appFingerprint}\n${words}`).digest("hex").slice(0, 16);
}

// The built site as it is served: a prerendered document per path, everything else a
// file, and the SPA shell for anything that has neither.
function serve() {
    return serveStatic(CLIENT, { fallback: "spa", host: "127.0.0.1" });
}

if (!existsSync(join(CLIENT, "index.html"))) {
    console.error(`No build in ${CLIENT}. Run \`npm run build\` first.`);
    process.exit(1);
}

// A single-locale build has only its own tree, and every other language would be served
// the SPA shell — which photographs as an empty page rather than as a failure, so it is
// worth refusing outright.
const sample = LOCALES.find((locale) => locale !== "en") ?? "en";
if (!existsSync(join(CLIENT, sample, "index.html"))) {
    console.error(
        `${CLIENT} holds only one language (no ${sample}/). These pictures are of all ` +
            `${LOCALES.length} of them — run \`npm run build\`, not \`build:single\`.`,
    );
    process.exit(1);
}

// Which languages to take, and why. `--all` re-shoots everything; `--locales=de,fr` takes
// a named few, which is how you check a change without driving two hundred and sixty page
// loads through a browser.
const argv = process.argv.slice(2);
const only = argv.find((one) => one.startsWith("--locales="))?.slice("--locales=".length);
const forced = argv.includes("--all");
const asked = only ? only.split(",").filter(Boolean) : LOCALES;
const unknown = asked.filter((locale) => !LOCALES.includes(locale));
if (unknown.length > 0) {
    console.error(`Not a language Plinky speaks: ${unknown.join(", ")}`);
    process.exit(1);
}

const ledger = existsSync(LEDGER) ? JSON.parse(await readFile(LEDGER, "utf8")) : {};
const wanted = [];
for (const locale of asked) {
    const fingerprint = await localeFingerprint(locale);
    const complete = SHOTS.every(([name]) => existsSync(join(OUT, locale, `${name}.webp`)));
    if (!forced && complete && ledger[locale] === fingerprint) {
        continue;
    }
    wanted.push([locale, fingerprint]);
}

if (wanted.length === 0) {
    console.log(`Every language's pictures are current (${asked.length} checked).`);
    process.exit(0);
}
console.log(
    `Taking ${wanted.length * SHOTS.length} pictures: ${wanted.map(([l]) => l).join(", ")}`,
);

const { server, port } = await serve();
const browser = await chromium.launch();

let taken = 0;
for (const [locale, fingerprint] of wanted) {
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

    // Written per language rather than at the end, so a run cut short keeps what it earned
    // and the next one picks up where it stopped instead of starting over.
    ledger[locale] = fingerprint;
    await writeFile(LEDGER, `${JSON.stringify(ledger, Object.keys(ledger).sort(), 4)}\n`);
    console.log(`  ${locale}  ${SHOTS.length} pictures`);
}

await browser.close();
server.close();
console.log(`Took ${taken} help pictures at ${WIDTH}×${HEIGHT}, quality ${QUALITY}.`);
