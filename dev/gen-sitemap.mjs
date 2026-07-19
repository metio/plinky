// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "build/client";

const settings = JSON.parse(readFileSync("project.inlang/settings.json", "utf8"));
const locales = new Set(settings.locales);
const baseLocale = settings.baseLocale;

// Single source of truth for the origin: read it from site.ts rather than duplicate.
const SITE_URL = readFileSync("core/site.ts", "utf8").match(/SITE_URL\s*=\s*"([^"]+)"/)[1];

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

// Canonical paths kept out of the sitemap: they carry a noindex in their head
// (legal notices, and the personal/utility surfaces), so listing them would tell
// search engines to index what those pages themselves forbid.
const NOINDEX = new Set(["impressum", "datenschutz", "you", "review", "settings"]);

// Group localized pages by their canonical (locale-stripped) path.
const groups = new Map();
for (const rel of pagesUnder(ROOT, "").sort()) {
    const [locale, ...rest] = rel.split("/");
    if (!locales.has(locale)) {
        continue;
    }
    const canonical = rest.join("/");
    if (NOINDEX.has(canonical)) {
        continue;
    }
    if (!groups.has(canonical)) {
        groups.set(canonical, new Map());
    }
    groups.get(canonical).set(locale, `${SITE_URL}/${rel}/`);
}

const escape = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Bucket each page's <url> block under its own locale, so every locale gets a child
// sitemap. Each block carries the whole group's hreflang alternates (all locales +
// x-default), which every URL in a language cluster must list, itself included.
const byLocale = new Map();
for (const localeUrls of groups.values()) {
    const alternates = [...localeUrls.entries()].map(
        ([locale, url]) =>
            `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escape(url)}"/>`,
    );
    const xDefault = localeUrls.get(baseLocale) ?? [...localeUrls.values()][0];
    alternates.push(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escape(xDefault)}"/>`,
    );
    const alternateBlock = alternates.join("\n");
    for (const [locale, url] of localeUrls.entries()) {
        if (!byLocale.has(locale)) {
            byLocale.set(locale, []);
        }
        byLocale
            .get(locale)
            .push(`  <url>\n    <loc>${escape(url)}</loc>\n${alternateBlock}\n  </url>\n`);
    }
}

const childLocales = [...byLocale.keys()].sort();
let totalUrls = 0;
for (const locale of childLocales) {
    const body = byLocale.get(locale).join("");
    totalUrls += byLocale.get(locale).length;
    const child = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}</urlset>\n`;
    writeFileSync(join(ROOT, `sitemap-${locale}.xml`), child);
}

const indexBody = childLocales
    .map(
        (locale) =>
            `  <sitemap>\n    <loc>${escape(`${SITE_URL}/sitemap-${locale}.xml`)}</loc>\n  </sitemap>\n`,
    )
    .join("");
const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexBody}</sitemapindex>\n`;
writeFileSync(join(ROOT, "sitemap.xml"), index);

console.log(
    `Wrote sitemap.xml index → ${childLocales.length} locale sitemaps, ${totalUrls} URLs total.`,
);
