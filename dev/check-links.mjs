// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every internal link in the tree about to be uploaded points at the address that answers,
// not at one that redirects to it.
//
// The site redirects generously — an address with no language, a page that was retired, a
// spelling without the trailing slash — and every one of those is a 301 a crawler has to
// follow before it reads anything. That is right for a link somebody kept from two years
// ago and wrong for a link the site writes itself: a page that links to its own site
// through a redirect spends a crawl on a hop it could have skipped, and Search Console
// records the address it was sent from as a page that redirects rather than as a page.
//
// One rule, and app/components/ui/href.ts already keeps it: a link is a language prefix
// and a trailing slash. This is what makes that a fact about the deploy rather than a
// convention about the source — a link written by hand somewhere the helper does not
// reach reads exactly the same in review and is caught here.
//
// Plain JavaScript on Node built-ins, because the deploy runs it with nothing installed.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = "build/client";

// A link to a file rather than to a page: the fonts, the cards, the manifests. Those are
// named exactly and have no trailing slash to add.
const A_FILE = /\.[a-z0-9]{2,12}$/i;

// The href attributes of one document, without the fragment or the query, and without
// anything pointing off the site.
export function internalLinks(html) {
    return [...html.matchAll(/href="([^"]+)"/g)]
        .map((found) => found[1])
        .filter((href) => href.startsWith("/"))
        .map((href) => href.split("#")[0].split("?")[0])
        .filter((href) => href !== "" && !A_FILE.test(href));
}

// Why a link is not the address that answers, or null when it is.
export function complaint(href, locales) {
    if (href === "/") {
        // The bare root is the language chooser and redirects on purpose; a page that
        // links to it is linking to the chooser, which is a real destination.
        return null;
    }
    if (!href.endsWith("/")) {
        return "no trailing slash, so the host redirects to the slashed spelling";
    }
    const first = href.split("/")[1] ?? "";
    if (!locales.includes(first)) {
        return "no language, so the host redirects to the English page";
    }
    return null;
}

function documents(dir) {
    const found = [];
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            found.push(...documents(path));
        } else if (name.endsWith(".html")) {
            found.push(path);
        }
    }
    return found;
}

// Every complaint in the tree, as `{ file, href, why }`.
export function findRedirectingLinks(out = OUT, locales = []) {
    const found = [];
    for (const file of documents(out)) {
        const html = readFileSync(file, "utf8");
        for (const href of new Set(internalLinks(html))) {
            const why = complaint(href, locales);
            if (why) {
                found.push({ file, href, why });
            }
        }
    }
    return found;
}

export function checkLinks(out = OUT, settings = "project.inlang/settings.json") {
    const { locales } = JSON.parse(readFileSync(settings, "utf8"));
    const found = findRedirectingLinks(out, locales);
    if (found.length > 0) {
        const listed = found
            .slice(0, 20)
            .map((one) => `  ${one.href} — ${one.why}\n    in ${one.file}`)
            .join("\n");
        throw new Error(
            `${found.length} internal link(s) point at an address that redirects:\n${listed}\n` +
                "Build in-app URLs through localizedHref (app/components/ui/href.ts), which " +
                "adds the language and the slash.",
        );
    }
    return { documents: documents(out).length };
}

if (process.argv[1]?.endsWith("check-links.mjs")) {
    const { documents: count } = checkLinks();
    console.log(`Every internal link in ${count} documents names the address that answers.`);
}
