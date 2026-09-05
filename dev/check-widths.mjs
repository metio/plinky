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
// It measures whichever single locale is on disk rather than assuming English, and
// `ci-widths` builds the one that stresses a narrow layout hardest (dev/widest-locale.mjs
// names it). English is the language every string in the app was written to fit; a word
// that cannot be broken arrives in translation, and until this gate stopped assuming en it
// was the one language whose layout did not need checking.
//
// Build-dependent, so it runs where the other build-dependent checks run rather than in
// the pre-push loop: `nix develop --command ci-widths`.

import { chromium } from "playwright";
import { staticPaths } from "./pages.mjs";
import { pageUrl } from "./sitemap.mjs";
import { builtLocales } from "./single-locale-build.mjs";
import { serveStatic } from "./staticServer.mjs";

// The narrowest phone still in wide use, the common Android width, and the common iPhone.
const WIDTHS = [320, 360, 390];

const root = "build/client";
// Whatever single language is on disk. Two would mean an all-locales `npm run build`,
// whose pages are the same document twenty-six times over and take that much longer to
// drive; one is what a visitor downloads and what every other per-visitor gate measures.
const built = builtLocales();
if (built.length === 0) {
    console.error(
        "No build to measure. Run `nix develop --command ci-widths`, which builds the\n" +
            "locale that stresses a narrow layout hardest and then runs this.",
    );
    process.exit(1);
}
if (built.length > 1) {
    console.error(
        `build/client holds ${built.length} prerendered locales. This measures one, the way a\n` +
            "visitor reads one. Run `nix develop --command ci-widths`.",
    );
    process.exit(1);
}
const LOCALE = built[0];
console.log(`Measuring the ${LOCALE} build.`);

const { port, close } = await serveStatic(root);

const paths = staticPaths();
const browser = await chromium.launch();
const problems = [];
try {
    for (const width of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 720 } });
        for (const path of paths) {
            const url = pageUrl(`http://localhost:${port}`, LOCALE, path);
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
                //
                // The DEEPEST offender, not the widest. Width propagates upward: a heading
                // too wide for the screen makes its section too wide, and its main, and its
                // body, and every one of those is "an element wider than the screen". Naming
                // them by width names the outermost, which is the one element that cannot be
                // fixed — `main.mx-auto (362px wide)` is true and tells nobody anything. The
                // leaf is what to change, so a leaf is what gets printed: over-wide, with no
                // over-wide descendant, and carrying the text that made it so.
                //
                // Two ways to be over-wide, and both count. Reaching past the viewport is the
                // usual shape; an element clipped by an ancestor's overflow still widens the
                // document while its own rect stays inside, and reporting nothing at all is
                // the one outcome that helps nobody — which is what this printed the first
                // time it caught a real overflow.
                const named = (node) => {
                    const cls = String(node.className || "")
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .join(".");
                    return `${node.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`;
                };
                const all = [...document.querySelectorAll("body *")];
                const reaches = (node) => node.getBoundingClientRect().right > doc.clientWidth + 1;
                const over = all.filter(
                    (node) => node.scrollWidth > doc.clientWidth || reaches(node),
                );
                const leaves = over.filter(
                    (node) => !over.some((other) => other !== node && node.contains(other)),
                );
                const culprits = leaves.slice(0, 3).map((node) => {
                    const text = (node.textContent ?? "").trim().replace(/\s+/g, " ");
                    const shown = text.length > 48 ? `${text.slice(0, 48)}…` : text;
                    return `${named(node)} (${Math.round(node.scrollWidth)}px${shown ? ` — "${shown}"` : ""})`;
                });
                return { spill, culprits, clipped: !leaves.some(reaches) };
            });
            if (over) {
                const blame =
                    over.culprits.length > 0
                        ? `${over.clipped ? "widest inside the page" : "reaching past"} — ${over.culprits.join("; ")}`
                        : "nothing on the page reaches past it — check a fixed or absolutely positioned element";
                problems.push(`${width}px ${path}: ${over.spill}px past the screen — ${blame}`);
            }
        }
        await page.close();
        console.log(`  ${width}px — ${paths.length} pages`);
    }
} finally {
    await browser.close();
    await close();
}

if (problems.length > 0) {
    console.error(`\n${problems.length} pages wider than the screen:`);
    for (const problem of problems.slice(0, 20)) {
        console.error(`  ${problem}`);
    }
    process.exit(1);
}
console.log(`\nEvery page fits ${WIDTHS.join(", ")}px.`);
