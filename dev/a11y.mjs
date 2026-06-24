// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Accessibility gate. Serves the built site, drives Chromium with the theme
// forced to A11Y_MODE (light or dark), and runs the full axe-core ruleset against
// each prerendered page. Lighthouse only audits light mode, so running both modes
// here is the only way dark-mode issues (contrast especially) get caught. Exits
// non-zero on any violation.
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const ROOT = "build/client";
const PORT = Number(process.env.PORT) || 8099;
const MODE = process.env.A11Y_MODE === "light" ? "light" : "dark";
const PAGES = ["/", "/songs/", "/scores/", "/tracks/", "/curriculums/", "/progress/", "/settings/"];
const MIME = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
};

const axeSrc = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

// A static server matching how GitHub Pages serves the build: directory URLs map
// to their index.html, and unknown paths fall back to the SPA shell.
const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path.endsWith("/")) {
        path += "index.html";
    }
    let file = join(ROOT, path);
    if (!existsSync(file)) {
        file = join(ROOT, "index.html");
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
let total = 0;
console.log(`axe (${MODE} mode):`);
for (const path of PAGES) {
    const ctx = await browser.newContext({ colorScheme: MODE });
    const page = await ctx.newPage();
    await page.addInitScript((mode) => {
        try {
            localStorage.setItem("plinky:theme", mode);
        } catch {}
    }, MODE);
    await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle" });
    await page
        .waitForFunction(
            (dark) => document.documentElement.classList.contains("dark") === dark,
            MODE === "dark",
            { timeout: 4000 },
        )
        .catch(() => {});
    await page.addScriptTag({ content: axeSrc });
    const result = await page.evaluate(
        async () =>
            // biome-ignore lint/suspicious/noExplicitAny: axe is injected at runtime
            await /** @type {any} */ (window).axe.run(document),
    );
    const count = result.violations.reduce((sum, v) => sum + v.nodes.length, 0);
    total += count;
    console.log(`  ${path} — violations: ${count}`);
    for (const v of result.violations) {
        console.log(`    [${v.id}] ${v.nodes.length}× — ${v.help}`);
        for (const node of v.nodes) {
            console.log(`      ${node.target.join(" ")}`);
        }
    }
    await ctx.close();
}
await browser.close();
server.close();
console.log(`TOTAL (${MODE}): ${total}`);
process.exitCode = total > 0 ? 1 : 0;
