// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Illustrates the help page with real screenshots, bundled with the app so /help works
// offline. Serves the built site (build/client), drives Chromium to each app section,
// and writes public/help/<key>.png — the pictures the local help adapter references. No
// network, no CMS: rerun after a UI change to refresh the illustrations, then commit the
// updated PNG files. Requires a prior `npm run build:client` (or ci-build) so build/client
// exists with a prerendered play page.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const ROOT = "build/client";
const OUT = "public/help";
const PORT = Number(process.env.PORT) || 8098;

if (!existsSync(ROOT)) {
    console.error(`${ROOT} not found — run \`nix develop --command ci-build\` first.`);
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// The play page needs a piece; any prerendered one will do.
const playId = readdirSync(join(ROOT, "en", "play"), { withFileTypes: true }).find((entry) =>
    entry.isDirectory(),
)?.name;

// One screenshot per help section: the page it explains. `selector` waits for the
// page's real content before shooting; the play page is ready once the score's SVG exists.
const SECTIONS = [
    { key: "gettingStarted", path: "/en/", selector: "main" },
    { key: "home", path: "/en/", selector: "main" },
    { key: "play", path: `/en/play/${playId}`, selector: "svg" },
    { key: "library", path: "/en/library", selector: "main" },
    { key: "daily", path: "/en/daily", selector: "main" },
    { key: "ear", path: "/en/ear", selector: "main" },
    { key: "compose", path: "/en/compose", selector: "main" },
    { key: "assignments", path: "/en/assignments", selector: "main" },
    { key: "you", path: "/en/you", selector: "main" },
    { key: "review", path: "/en/review", selector: "main" },
    { key: "settings", path: "/en/settings", selector: "main" },
];

const MIME = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".mxl": "application/octet-stream",
    ".webmanifest": "application/manifest+json",
};

// A static server matching how GitHub Pages serves the build: directory URLs map to
// their index.html, and unknown paths fall back to the SPA shell.
const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path.endsWith("/")) {
        path += "index.html";
    }
    let file = join(ROOT, path);
    if (existsSync(file) && statSync(file).isDirectory()) {
        file = join(file, "index.html");
    }
    if (!existsSync(file)) {
        file = join(ROOT, "index.html");
    }
    res.setHeader("content-type", MIME[extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
});

await new Promise((resolve) => server.listen(PORT, resolve));
// Scale 1 and a modest viewport keep the bundled PNG files small — the help page lazy-loads
// them below the fold, so a device-pixel-perfect shot isn't worth the extra weight.
const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: 1000, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "light",
});

let failed = false;
for (const section of SECTIONS) {
    try {
        await page.goto(`http://localhost:${PORT}${section.path}`, { waitUntil: "networkidle" });
        await page.waitForSelector(section.selector, { timeout: 30_000 });
        // Let web fonts and late layout settle so the picture is what users see.
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        const png = await page.screenshot({ type: "png" });
        writeFileSync(join(OUT, `${section.key}.png`), png);
        console.log(`${section.key}: written to ${OUT}/${section.key}.png`);
    } catch (error) {
        failed = true;
        console.error(`${section.key}: ${error.message}`);
    }
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
