// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The XML assembly behind the sitemap, kept apart from the build tree it describes so the
// shape can be tested without a 26-locale prerender standing by. dev/gen-sitemap.mjs walks
// the prerendered output and hands the pages it found here.

// A sitemap may hold at most 50,000 URLs; a search engine enforces that by rejecting the
// whole file. One child per locale leaves today's pages far clear of it, so this is a
// tripwire for a catalogue that has outgrown the layout rather than a live constraint —
// and a build that fails is better than a sitemap that is silently ignored.
const MAX_URLS_PER_SITEMAP = 50_000;

const escape = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A page's absolute URL. Every page prerenders to `<path>/index.html`, so the
// trailing-slash form is what the static host serves and what the document's own canonical
// link names — the sitemap has to name the identical URL, or the two disagree about which
// of the pair is the real one and the hreflang cluster no longer resolves.
export function pageUrl(siteUrl, locale, path) {
    return `${siteUrl}/${locale}${path === "/" ? "/" : `${path}/`}`;
}

const alternate = (hreflang, href) =>
    `    <xhtml:link rel="alternate" hreflang="${escape(hreflang)}" href="${escape(href)}"/>`;

// One `<urlset>` per locale, plus the `<sitemapindex>` pointing at them.
//
//   entries  — `{ locale, path }` pairs, `path` canonical (locale-stripped), "/" for the
//              locale index. The prerendered tree is the source; a page absent from it is
//              absent here.
//   noindex  — canonical paths to leave out whatever the tree holds, because their own
//              documents carry a noindex robots meta. Advertising a page for indexing that
//              forbids indexing is a contradiction search engines report as an error.
//
// Every URL carries the whole cluster's hreflang alternates — each locale that has the
// page, itself included, plus x-default — which is what ties the language versions of a
// page together instead of leaving them competing as duplicates.
export function buildSitemaps({ entries, siteUrl, baseLocale, lastmod, noindex = [] }) {
    const skip = new Set(noindex);

    // Group by canonical path first: the alternates a URL needs are a property of the page
    // across languages, not of the one locale whose child sitemap it lands in.
    const groups = new Map();
    for (const { locale, path } of entries) {
        if (skip.has(path)) {
            continue;
        }
        if (!groups.has(path)) {
            groups.set(path, new Set());
        }
        groups.get(path).add(locale);
    }

    const byLocale = new Map();
    for (const path of [...groups.keys()].sort()) {
        const localesHere = [...groups.get(path)].sort();
        const links = localesHere.map((locale) => alternate(locale, pageUrl(siteUrl, locale, path)));
        // x-default names the base locale's copy. A page that somehow exists in other
        // languages but not the base one still needs the tag, so the first stands in.
        const fallback = localesHere.includes(baseLocale) ? baseLocale : localesHere[0];
        links.push(alternate("x-default", pageUrl(siteUrl, fallback, path)));
        const cluster = links.join("\n");

        for (const locale of localesHere) {
            if (!byLocale.has(locale)) {
                byLocale.set(locale, []);
            }
            byLocale
                .get(locale)
                .push(
                    `  <url>\n    <loc>${escape(pageUrl(siteUrl, locale, path))}</loc>\n    <lastmod>${escape(lastmod)}</lastmod>\n${cluster}\n  </url>\n`,
                );
        }
    }

    const children = new Map();
    for (const locale of [...byLocale.keys()].sort()) {
        const urls = byLocale.get(locale);
        if (urls.length > MAX_URLS_PER_SITEMAP) {
            throw new Error(
                `sitemap-${locale}.xml would hold ${urls.length} URLs, over the ${MAX_URLS_PER_SITEMAP} a sitemap may carry — ` +
                    "split the locale's pages across numbered children before this ships",
            );
        }
        children.set(
            locale,
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("")}</urlset>\n`,
        );
    }

    // The index carries each child's <lastmod> as well, so a crawler can tell which
    // locales moved without fetching all 26 children to find out.
    const body = [...children.keys()]
        .map(
            (locale) =>
                `  <sitemap>\n    <loc>${escape(`${siteUrl}/sitemap-${locale}.xml`)}</loc>\n    <lastmod>${escape(lastmod)}</lastmod>\n  </sitemap>\n`,
        )
        .join("");

    return {
        index: `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}</sitemapindex>\n`,
        children,
    };
}
