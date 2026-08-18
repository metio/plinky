// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Takes the pictures the help page shows of each part of the app, straight from a real
// build. They were captured by hand before this existed, which is why they went on
// showing a navigation bar and a colour scheme the app had stopped having: nothing
// connected the pictures to the thing they were pictures of.
//
// Run it after a build: `npm run build:single && npm run help:shots`.
//
// Every shot is of a fresh device — no progress, no imported scores, nothing dismissed —
// because that is the app a reader opening the help page is most likely looking at, and
// because a screenshot of somebody else's progress is a screenshot of a fiction.
//
// The webp encoding is done by the browser that took the shot (a canvas encodes it), so
// this needs no image library and no host binary: anywhere Playwright runs, this runs.

import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

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
    ["home", "/en/"],
    ["play", `/en/play/${PIECE}/`],
    ["music", "/en/music/"],
    ["daily", "/en/daily/"],
    ["ear", "/en/ear/"],
    ["compose", "/en/compose/"],
    ["assignments", "/en/assignments/"],
    ["stats", "/en/stats/"],
    ["review", "/en/review/"],
    ["settings", "/en/settings/"],
];

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".mxl": "application/octet-stream",
    ".musicxml": "application/xml",
    ".webmanifest": "application/manifest+json",
};

// The built site as it is served: a prerendered document per path, everything else a
// file, and the SPA shell for anything that has neither.
function serve() {
    const server = createServer((request, response) => {
        const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname));
        const candidates = [join(CLIENT, path), join(CLIENT, path, "index.html")];
        const file = candidates.find((one) => existsSync(one) && statSync(one).isFile());
        const served = file ?? join(CLIENT, "index.html");
        response.writeHead(200, { "content-type": TYPES[extname(served)] ?? "text/plain" });
        createReadStream(served).pipe(response);
    });
    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
    });
}

if (!existsSync(join(CLIENT, "index.html"))) {
    console.error(`No build in ${CLIENT}. Run \`npm run build:single\` first.`);
    process.exit(1);
}

const { server, port } = await serve();
const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: "light",
    // The pictures are of the app in English, like the rest of the page's own copy.
    locale: "en-GB",
    // A picture of a moving thing is a picture of one frame of it. Everything the app
    // animates is decorative and drops out under this, which is what a still wants.
    reducedMotion: "reduce",
});

await mkdir(OUT, { recursive: true });
for (const [name, path] of SHOTS) {
    await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "networkidle" });
    // The parts that read local state render after mount, so the shot waits for the page
    // to have finished arriving rather than for the document to exist.
    await page.waitForSelector("main", { state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    const png = await page.screenshot({ type: "png" });

    // Chromium encodes the webp itself, from the shot it just took.
    const webp = await page.evaluate(async ({ dataUrl, quality }) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d").drawImage(image, 0, 0);
        return canvas.toDataURL("image/webp", quality);
    }, { dataUrl: `data:image/png;base64,${png.toString("base64")}`, quality: QUALITY });
    if (!webp.startsWith("data:image/webp")) {
        throw new Error(`${name}: the browser would not encode webp`);
    }
    const bytes = Buffer.from(webp.split(",")[1], "base64");
    await writeFile(join(OUT, `${name}.webp`), bytes);
    console.log(`  ${name}.webp  ${(bytes.byteLength / 1024).toFixed(0)} KB  ${path}`);
}

await browser.close();
server.close();
console.log(`Took ${SHOTS.length} help pictures at ${WIDTH}×${HEIGHT}, quality ${QUALITY}.`);
