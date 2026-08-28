// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Accessibility gate. Serves the built site, drives Chromium with the theme
// forced to A11Y_MODE (light or dark), and runs the full axe-core ruleset against
// each prerendered page. Lighthouse only audits light mode, so running both modes
// here is the only way dark-mode issues (contrast especially) get caught. Exits
// non-zero on any violation.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import lighthouserc from "../lighthouserc.js";
import { requireSingleLocaleBuild } from "./single-locale-build.mjs";

// The npm script builds the single locale first, so this only fires when the script is
// run by hand over a tree something else left behind — an all-locales build serves each
// audited page a bundle no visitor downloads. Which locale is audited follows the build
// (lighthouserc.js reads it off the tree), so this cannot end up auditing a language that
// was never built.
requireSingleLocaleBuild("the a11y gate");

const ROOT = "build/client";
const PORT = Number(process.env.PORT) || 8099;
const MODE = process.env.A11Y_MODE === "light" ? "light" : "dark";
// One canonical page list, shared with the Lighthouse gate (lighthouserc.json), so the
// two audits always cover exactly the same set and can't drift — add a page in one
// place and both pick it up. Strip the host to get each prerendered path; the URLs are
// already locale-prefixed (the bare "/" is only a client redirect, so it isn't listed).
const PAGES = lighthouserc.ci.collect.url.map((url) => new URL(url).pathname);
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

// Which document each request actually got, so a page that fell through to the SPA shell
// cannot be audited as though it were the page.
const served = new Map();

// A static server matching how Cloudflare Pages serves the build: directory URLs map
// to their index.html, and unknown paths fall back to the SPA shell.
const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path.endsWith("/")) {
        path += "index.html";
    }
    let file = join(ROOT, path);
    // A directory path without a trailing slash (e.g. /en/scores) would otherwise
    // readFileSync a directory and throw EISDIR; serve its index.html instead.
    if (existsSync(file) && statSync(file).isDirectory()) {
        file = join(file, "index.html");
    }
    if (!existsSync(file)) {
        // The SPA shell, the way Cloudflare Pages serves an unknown path. Recorded,
        // because every page in the audited set is prerendered: reaching the shell means
        // the page was not built, and axe would find nothing wrong with an empty document
        // and report it as a clean pass. That is exactly what happened when the build
        // moved to another language while the audited URLs stayed on /en/ — twenty-two
        // pages, zero violations, none of them real.
        served.set(path, "fallback");
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
const unbuilt = [];
console.log(`axe (${MODE} mode):`);
for (const path of PAGES) {
    const ctx = await browser.newContext({ colorScheme: MODE });
    const page = await ctx.newPage();
    await page.addInitScript((mode) => {
        try {
            localStorage.setItem("plinky:theme", JSON.stringify(mode));
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
        async () => await /** @type {any} */ (window).axe.run(document),
    );
    const count = result.violations.reduce((sum, v) => sum + v.nodes.length, 0);
    total += count;
    // The page's own document, or the shell standing in for one that was never built.
    const wanted = path.endsWith("/") ? `${path}index.html` : path;
    if (served.get(wanted) === "fallback") {
        unbuilt.push(path);
    }
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
if (unbuilt.length > 0) {
    console.error(
        `\n${unbuilt.length} of the ${PAGES.length} audited pages were never built, so axe ` +
            "read the SPA shell and found nothing wrong with it:",
    );
    for (const path of unbuilt) {
        console.error(`  ${path}`);
    }
    console.error(
        "\nA clean sweep over pages that do not exist is the one result worth nothing. Build\n" +
            "the site the audit expects: nix develop --command npm run a11y:light\n",
    );
}
process.exitCode = total > 0 || unbuilt.length > 0 ? 1 : 0;
