// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generates the sitemap from the prerendered output, so it always matches exactly
// what was built. `sitemap.xml` is a sitemap *index* pointing at one child sitemap
// per locale (`sitemap-en.xml`, `sitemap-de.xml`, …); each child lists that
// locale's pages with the full set of hreflang alternates (every locale +
// x-default), which ties all language versions into one cluster for search
// engines. Run after the build (see package.json).
//
// The children sit at the site root, not under a folder: a sitemap may only list
// URLs at or below its own directory, so a root-level child can carry every
// `/<locale>/…` page while a `/sitemaps/…` one could not. The index keeps a single
// stable entry point (`/sitemap.xml`, the URL robots.txt advertises and Search
// Console holds), so growing the catalogue never needs a re-submit.
//
// This file is the I/O half: it walks the build tree, reads the origin and the locale
// set, and writes the files. dev/sitemap.mjs assembles the XML and is tested directly.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertPages, noindexPaths } from "./pages.mjs";
import { buildSitemaps } from "./sitemap.mjs";

const ROOT = "build/client";

const settings = JSON.parse(readFileSync("project.inlang/settings.json", "utf8"));
const locales = new Set(settings.locales);
const baseLocale = settings.baseLocale;

// Single source of truth for the origin: read it from site.ts rather than duplicate.
const SITE_URL = readFileSync("core/site.ts", "utf8").match(/SITE_URL\s*=\s*"([^"]+)"/)[1];

// The build date, stamped on every URL as <lastmod>. A deploy ships the latest commit
// as one build, so the whole tree shares this date — an honest "last generated" signal
// for crawl scheduling in the W3C date form the sitemap spec accepts.
const LASTMOD = new Date().toISOString().slice(0, 10);

// Collect the directory of every prerendered index.html (the bare-root redirect
// shell at "" is excluded — it carries no indexable content).
function pagesUnder(dir, rel) {
    const found = [];
    let hasIndex = false;
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            found.push(...pagesUnder(full, rel ? `${rel}/${name}` : name));
        } else if (name === "index.html") {
            hasIndex = true;
        }
    }
    if (hasIndex && rel) {
        found.push(rel);
    }
    return found;
}

// Which pages carry a noindex robots meta is read off the routes that declare it rather
// than restated here, because a restated list falls behind the moment a route adds the
// call — and every page it misses is submitted for indexing in all 26 locales while its own
// document tells crawlers to stay out. assertPages() runs first, so a reading that has gone
// stale fails here rather than quietly emitting a sitemap that contradicts the pages.
assertPages();
const noindex = noindexPaths();

// Split each prerendered directory into the locale it belongs to and the canonical path
// within it, dropping anything outside a known locale (assets, the bare-root shell).
const entries = [];
for (const rel of pagesUnder(ROOT, "")) {
    const [locale, ...rest] = rel.split("/");
    if (!locales.has(locale)) {
        continue;
    }
    entries.push({ locale, path: rest.length === 0 ? "/" : `/${rest.join("/")}` });
}

const { index, children } = buildSitemaps({
    entries,
    siteUrl: SITE_URL,
    baseLocale,
    lastmod: LASTMOD,
    noindex,
});

for (const [locale, xml] of children) {
    writeFileSync(join(ROOT, `sitemap-${locale}.xml`), xml);
}
writeFileSync(join(ROOT, "sitemap.xml"), index);

const totalUrls = [...children.values()].reduce(
    (sum, xml) => sum + (xml.match(/<url>/g) ?? []).length,
    0,
);
console.log(
    `Wrote sitemap.xml index → ${children.size} locale sitemaps, ${totalUrls} URLs total ` +
        `(${noindex.length} noindex pages left out per locale).`,
);
