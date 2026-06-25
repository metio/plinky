// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Generates build/client/sitemap.xml from the prerendered output, so it always
// matches exactly what was built. Each localized page is listed with the full
// set of hreflang alternates (every locale + x-default), which tells search
// engines about all language versions and ties them into one cluster. Run after
// the build (see package.json).

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "build/client";

const settings = JSON.parse(readFileSync("project.inlang/settings.json", "utf8"));
const locales = new Set(settings.locales);
const baseLocale = settings.baseLocale;

// Single source of truth for the origin: read it from site.ts rather than duplicate.
const SITE_URL = readFileSync("app/lib/site.ts", "utf8").match(/SITE_URL\s*=\s*"([^"]+)"/)[1];

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

// Group localized pages by their canonical (locale-stripped) path.
const groups = new Map();
for (const rel of pagesUnder(ROOT, "").sort()) {
    const [locale, ...rest] = rel.split("/");
    if (!locales.has(locale)) {
        continue;
    }
    const canonical = rest.join("/");
    if (!groups.has(canonical)) {
        groups.set(canonical, new Map());
    }
    groups.get(canonical).set(locale, `${SITE_URL}/${rel}/`);
}

const escape = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let body = "";
for (const localeUrls of groups.values()) {
    const alternates = [...localeUrls.entries()].map(
        ([locale, url]) =>
            `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escape(url)}"/>`,
    );
    const xDefault = localeUrls.get(baseLocale) ?? [...localeUrls.values()][0];
    alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escape(xDefault)}"/>`);
    for (const url of localeUrls.values()) {
        body += `  <url>\n    <loc>${escape(url)}</loc>\n${alternates.join("\n")}\n  </url>\n`;
    }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}</urlset>\n`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap);
console.log(
    `Wrote sitemap.xml: ${groups.size} pages × locales = ${[...groups.values()].reduce((n, m) => n + m.size, 0)} URLs.`,
);
