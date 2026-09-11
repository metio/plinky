// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Accessibility gate. Serves the built site, drives Chromium with the theme
// forced to A11Y_MODE (light or dark), and runs the full axe-core ruleset against
// each prerendered page. Lighthouse only audits light mode, so running both modes
// here is the only way dark-mode issues (contrast especially) get caught. Exits
// non-zero on any violation.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import lighthouserc from "../lighthouserc.js";
import { requireSingleLocaleBuild } from "./single-locale-build.mjs";
import { neverBuilt, serveStatic } from "./staticServer.mjs";

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
const axeSrc = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

// Every path the server answered with the SPA shell, so a page that fell through to it
// cannot be audited as though it were the page.
const fellBack = new Set();

// A static server matching how Cloudflare Pages serves the build: directory URLs map
// to their index.html, and unknown paths fall back to the SPA shell.
const { server } = await serveStatic(ROOT, {
    fallback: "spa",
    onFallback: (path) => fellBack.add(path),
    port: PORT,
});

const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
let total = 0;
console.log(`axe (${MODE} mode):`);
for (const path of PAGES) {
    // Reduced motion, so axe measures each page at rest. The landing keyboard fades its keys
    // in one after another over most of a second, and a key caught half-faded fails contrast
    // or passes it depending on how fast the page loaded — a sweep that measures a frame
    // rather than the page. Every animation here already stands down under this preference.
    const ctx = await browser.newContext({ colorScheme: MODE, reducedMotion: "reduce" });
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
// Pages the shell stood in for, because they were never built.
const unbuilt = neverBuilt(PAGES, fellBack);
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
