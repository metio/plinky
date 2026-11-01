// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fails if a page that reads the address disagrees with the document it is hydrating.
//
// Every page ships as a static document, and one document answers every query string, so
// it is written as though there were none. A page that chooses what to show from the
// address during its first client render therefore disagrees with the markup it is
// hydrating, and React answers a mismatch by discarding that markup and rendering the
// subtree again — which costs the player the paint they already had and loses anything
// the discarded tree was holding. It is invisible in development, where the page is
// client-rendered from the start and there is nothing to disagree with.
//
// The paths are hand-kept because a query cannot be read off app/routes.ts: the table
// names routes, and these are the addresses whose PARAMETERS change what renders. A page
// that stops reading its query is a line to delete here; one that starts reading a new
// parameter is a line to add. An address that no longer resolves fails rather than
// passing, so a renamed route cannot leave this measuring the fallback shell.
//
// Build-dependent, so it runs where the other build-dependent checks run:
// `nix develop --command ci-hydration`.

import { chromium } from "playwright";
import { builtLocales } from "./single-locale-build.mjs";
import { neverBuilt, serveStatic } from "./staticServer.mjs";

// The addresses whose parameters decide what is rendered, and the default each one
// departs from — a review link into a drill, a suggestion, a shelf opened on a tab.
const QUERIES = [
    "/ear/?exercise=progressions&level=3",
    "/ear/?exercise=melodic-dictation&level=2",
    "/ear/?exercise=progressions&level=1&progression=I-IV-V-I&tonic=0",
    "/music/?tab=manage",
    "/music/?tab=people",
    "/music/?q=bach",
    "/daily/?mode=warmup",
    "/assignments/?assignment=notacode",
];

const root = "build/client";
const built = builtLocales();
if (built.length !== 1) {
    console.error(
        built.length === 0
            ? "No build to read. Run `nix develop --command ci-hydration`, which builds the\nsite and then reads it."
            : `build/client holds ${built.length} prerendered locales. This reads one, the way a\nvisitor reads one. Run \`nix develop --command ci-hydration\`.`,
    );
    process.exit(1);
}
const LOCALE = built[0];
const PAGES = QUERIES.map((query) => `/${LOCALE}${query}`);
console.log(`Reading ${PAGES.length} addresses of the ${LOCALE} build.`);

// Every path the server answered with the shell. A shell has no prerendered markup to
// disagree with, so it cannot mismatch — and would report a clean sweep over nothing.
const fellBack = new Set();
const { port, close } = await serveStatic(root, {
    fallback: "spa",
    onFallback: (path) => fellBack.add(path),
});
const browser = await chromium.launch();
const threw = new Map();

try {
    for (const path of PAGES) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const messages = [];
        page.on("pageerror", (error) => messages.push(String(error).split("\n")[0].slice(0, 160)));
        await page.goto(`http://localhost:${port}${path}`, { waitUntil: "networkidle" });
        // A mismatch is reported as the subtree is re-rendered, which happens after the
        // first paint rather than during it.
        await page.waitForTimeout(700);
        if (messages.length > 0) {
            threw.set(path, messages);
        }
        await page.close();
    }
} finally {
    await browser.close();
    await close();
}

const unbuilt = neverBuilt(PAGES, fellBack);
if (unbuilt.length > 0) {
    console.error(
        `\n${unbuilt.length} of the ${PAGES.length} addresses were answered with the fallback shell:`,
    );
    for (const path of unbuilt) {
        console.error(`  ${path}`);
    }
    console.error(
        "\nA shell carries no prerendered markup, so it has nothing to disagree with and\n" +
            "this would pass whatever the page did. Either the route was renamed and the list\n" +
            "above it is stale, or the site was not built.\n",
    );
}
if (threw.size > 0) {
    console.error(`\n${threw.size} of the ${PAGES.length} addresses threw while loading:`);
    for (const [path, messages] of threw) {
        console.error(`  ${path}`);
        for (const message of messages) {
            console.error(`    ${message}`);
        }
    }
    console.error(
        "\nA React error number decodes at https://react.dev/errors/<number>; #418 and #423\n" +
            "are hydration, meaning the page chose what to show from the address while the\n" +
            "document it was hydrating had been written with no address at all. app/hooks/\n" +
            "useHydrated.ts is the seam: read the query from the render after the first one.\n",
    );
}
if (threw.size === 0 && unbuilt.length === 0) {
    console.log(`Every one of the ${PAGES.length} addresses hydrates the document it was sent.`);
}
process.exitCode = threw.size > 0 || unbuilt.length > 0 ? 1 : 0;
