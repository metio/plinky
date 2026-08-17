// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fails if any page is wider than the screen it is being read on.
//
// A page that scrolls sideways on a phone is never a decision somebody made: it is one
// element that cannot wrap, and it takes the whole document with it. The footer did
// exactly that when a fourth channel was added — 117px past a 320px screen, on every page
// at once, because the row holding the About link, two legal pages and the icons had
// nowhere to put the overflow.
//
// It is measured rather than looked at, because looking is what missed it: the story
// screenshots render at a fixed 800px and the browser tests run without Tailwind, so
// neither can see a narrow-viewport layout at all. This drives the built site at the
// widths people actually hold.
//
// Build-dependent, so it runs where the other build-dependent checks run rather than in
// the pre-push loop: `npm run build:single && npm run widths`.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { staticPaths } from "./pages.mjs";

// The narrowest phone still in wide use, the common Android width, and the common iPhone.
const WIDTHS = [320, 360, 390];
const LOCALE = "en";

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
};

const root = "build/client";
if (!existsSync(join(root, LOCALE))) {
    console.error("No build to measure. Run npm run build:single first.");
    process.exit(1);
}

const server = createServer((request, response) => {
    const url = decodeURIComponent((request.url ?? "/").split("?")[0]);
    let file = join(root, normalize(url));
    if (existsSync(file) && statSync(file).isDirectory()) {
        file = join(file, "index.html");
    }
    if (!existsSync(file)) {
        response.writeHead(404);
        response.end();
        return;
    }
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

const paths = staticPaths();
const browser = await chromium.launch();
const problems = [];
try {
    for (const width of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 720 } });
        for (const path of paths) {
            const url = `http://localhost:${port}/${LOCALE}${path === "/" ? "/" : `${path}/`}`;
            await page.goto(url, { waitUntil: "domcontentloaded" });
            // Let anything that arrives after mount settle into its place first.
            await page.waitForTimeout(600);
            const over = await page.evaluate(() => {
                const doc = document.documentElement;
                const spill = doc.scrollWidth - doc.clientWidth;
                if (spill <= 0) {
                    return null;
                }
                // Name what is doing it, so the fix does not start with a hunt.
                const culprits = [...document.querySelectorAll("body *")]
                    .filter((node) => node.getBoundingClientRect().right > doc.clientWidth + 1)
                    .slice(0, 3)
                    .map((node) => `${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0]}`);
                return { spill, culprits };
            });
            if (over) {
                problems.push(`${width}px ${path}: ${over.spill}px past the screen — ${over.culprits.join(", ")}`);
            }
        }
        await page.close();
        console.log(`  ${width}px — ${paths.length} pages`);
    }
} finally {
    await browser.close();
    server.close();
}

if (problems.length > 0) {
    console.error(`\n${problems.length} pages wider than the screen:`);
    for (const problem of problems.slice(0, 20)) {
        console.error(`  ${problem}`);
    }
    process.exit(1);
}
console.log(`\nEvery page fits ${WIDTHS.join(", ")}px.`);
